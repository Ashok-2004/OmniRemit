using System;
using System.Collections.Generic;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace backend.Data
{
    public class CrmProxyResult
    {
        public int StatusCode { get; set; }
        public string Content { get; set; } = string.Empty;
        public bool IsSuccess => StatusCode >= 200 && StatusCode < 300;
    }

    public class CrmProxyService
    {
        private readonly HttpClient _client;
        private readonly string _clientId;
        private readonly string _clientSecret;
        private readonly string _baseUrl;
        private readonly ILogger<CrmProxyService> _logger;

        private string? _cachedToken;
        private DateTime _tokenExpiry = DateTime.MinValue;
        private readonly SemaphoreSlim _semaphore = new SemaphoreSlim(1, 1);

        public CrmProxyService(IConfiguration configuration, ILogger<CrmProxyService> logger)
        {
            _logger = logger;

            var section = configuration.GetSection("CrmApi");
            _baseUrl = section.GetValue<string>("BaseUrl") ?? throw new InvalidOperationException("CRM BaseUrl is not configured.");
            if (!_baseUrl.EndsWith("/"))
            {
                _baseUrl += "/";
            }
            _clientId = section.GetValue<string>("ClientId") ?? throw new InvalidOperationException("CRM ClientId is not configured.");
            _clientSecret = section.GetValue<string>("ClientSecret") ?? throw new InvalidOperationException("CRM ClientSecret is not configured.");

            // SSL validation bypass is only permitted when explicitly enabled (e.g. staging with self-signed cert).
            // Production must always have a valid certificate — DisableSslValidation defaults to false.
            var disableSsl = section.GetValue<bool>("DisableSslValidation", false);

            var handler = new HttpClientHandler();
            if (disableSsl)
            {
                handler.ServerCertificateCustomValidationCallback = HttpClientHandler.DangerousAcceptAnyServerCertificateValidator;
            }

            _client = new HttpClient(handler)
            {
                BaseAddress = new Uri(_baseUrl),
                // Explicit timeout prevents slow CRM responses from accumulating under load.
                Timeout = TimeSpan.FromSeconds(30)
            };
        }

        private async Task<string> GetTokenAsync(bool forceRefresh = false, CancellationToken cancellationToken = default)
        {
            // Fast path: valid cached token (no lock needed for reads)
            if (!forceRefresh && _cachedToken != null && DateTime.UtcNow < _tokenExpiry)
            {
                return _cachedToken;
            }

            await _semaphore.WaitAsync(cancellationToken);
            try
            {
                // Double-check after acquiring the lock
                if (!forceRefresh && _cachedToken != null && DateTime.UtcNow < _tokenExpiry)
                {
                    return _cachedToken;
                }

                _logger.LogInformation("[CRM Auth] Acquiring token from: {BaseUrl}token", _baseUrl);

                var payload = new Dictionary<string, string>
                {
                    { "client_id", _clientId },
                    { "client_secret", _clientSecret },
                    { "grant_type", "client_credentials" }
                };

                var request = new HttpRequestMessage(HttpMethod.Post, "token")
                {
                    Content = new FormUrlEncodedContent(payload)
                };

                var response = await _client.SendAsync(request, cancellationToken);
                _logger.LogInformation("[CRM Auth] Token response status: {StatusCode}", (int)response.StatusCode);

                if (!response.IsSuccessStatusCode)
                {
                    var errorBody = await response.Content.ReadAsStringAsync(cancellationToken);
                    _logger.LogError("[CRM Auth] Token acquisition failed. Status: {StatusCode}", (int)response.StatusCode);
                    throw new Exception($"Failed to acquire CRM token. Status: {response.StatusCode}");
                }

                var responseBody = await response.Content.ReadAsStringAsync(cancellationToken);
                using var doc = JsonDocument.Parse(responseBody);
                var root = doc.RootElement;

                _cachedToken = root.GetProperty("access_token").GetString();
                int expiresSec = root.GetProperty("expires_in").GetInt32();
                _tokenExpiry = DateTime.UtcNow.AddSeconds(expiresSec - 30);

                _logger.LogInformation("[CRM Auth] Token acquired. Expires in: {ExpiresIn}s", expiresSec);
                return _cachedToken ?? throw new Exception("Token field was missing in response.");
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                _logger.LogError(ex, "[CRM Auth] Error during token acquisition");
                throw;
            }
            finally
            {
                _semaphore.Release();
            }
        }

        public async Task<CrmProxyResult> ProxyGetAsync(string relativePath, CancellationToken cancellationToken = default)
        {
            var cleanPath = relativePath.StartsWith("/") ? relativePath.Substring(1) : relativePath;
            _logger.LogInformation("[CRM Proxy] GET {BaseUrl}{Path}", _baseUrl, cleanPath);

            try
            {
                var token = await GetTokenAsync(cancellationToken: cancellationToken);
                var request = new HttpRequestMessage(HttpMethod.Get, cleanPath);
                request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);

                var response = await _client.SendAsync(request, cancellationToken);
                _logger.LogInformation("[CRM Proxy] GET response: {StatusCode}", (int)response.StatusCode);

                if (response.StatusCode == System.Net.HttpStatusCode.Unauthorized)
                {
                    _logger.LogWarning("[CRM Proxy] 401 received. Refreshing token and retrying.");
                    token = await GetTokenAsync(forceRefresh: true, cancellationToken: cancellationToken);
                    request = new HttpRequestMessage(HttpMethod.Get, cleanPath);
                    request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
                    response = await _client.SendAsync(request, cancellationToken);
                    _logger.LogInformation("[CRM Proxy] Retry GET response: {StatusCode}", (int)response.StatusCode);
                }

                var content = await response.Content.ReadAsStringAsync(cancellationToken);
                // NOTE: Response body is intentionally NOT logged — it contains customer PII.
                return new CrmProxyResult
                {
                    StatusCode = (int)response.StatusCode,
                    Content = content
                };
            }
            catch (OperationCanceledException)
            {
                _logger.LogInformation("[CRM Proxy] Request cancelled: {Path}", cleanPath);
                return new CrmProxyResult
                {
                    StatusCode = 499, // Client Closed Request
                    Content = JsonSerializer.Serialize(new { status = 499, message = "Request cancelled." })
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[CRM Proxy] Exception in ProxyGetAsync for path: {Path}", cleanPath);
                return new CrmProxyResult
                {
                    StatusCode = 500,
                    Content = JsonSerializer.Serialize(new { status = 500, message = "Internal Proxy Error" })
                };
            }
        }
    }
}
