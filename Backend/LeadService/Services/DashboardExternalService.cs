using LeadManagement.Api.Models.Dtos;

namespace LeadManagement.Api.Services
{
    public interface IDashboardExternalService
    {
        Task<int?> GetInProgressCountAsync(DashboardFilterDto filters);
        Task<double?> GetConversionRateAsync(DashboardFilterDto filters);
    }

    public class DashboardExternalService : IDashboardExternalService
    {
        private readonly HttpClient _httpClient;
        private readonly IConfiguration _configuration;
        private readonly ILogger<DashboardExternalService> _logger;

        public DashboardExternalService(
            HttpClient httpClient,
            IConfiguration configuration,
            ILogger<DashboardExternalService> logger)
        {
            _httpClient = httpClient;
            _configuration = configuration;
            _logger = logger;
        }

        public async Task<int?> GetInProgressCountAsync(DashboardFilterDto filters)
        {
            var baseUrl = _configuration["ExternalDashboardApi:BaseUrl"];
            if (string.IsNullOrWhiteSpace(baseUrl))
            {
                _logger.LogInformation("External Dashboard API URL not configured for In Progress leads.");
                return null;
            }

            try
            {
                var response = await _httpClient.GetAsync($"{baseUrl.TrimEnd('/')}/in-progress");
                if (response.IsSuccessStatusCode)
                {
                    var result = await response.Content.ReadFromJsonAsync<InProgressKpiDto>();
                    return result?.InProgressLeads;
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to fetch In Progress count from external API.");
            }

            return null;
        }

        public async Task<double?> GetConversionRateAsync(DashboardFilterDto filters)
        {
            var baseUrl = _configuration["ExternalDashboardApi:BaseUrl"];
            if (string.IsNullOrWhiteSpace(baseUrl))
            {
                _logger.LogInformation("External Dashboard API URL not configured for Conversion Rate.");
                return null;
            }

            try
            {
                var response = await _httpClient.GetAsync($"{baseUrl.TrimEnd('/')}/conversion-rate");
                if (response.IsSuccessStatusCode)
                {
                    var result = await response.Content.ReadFromJsonAsync<ConversionRateKpiDto>();
                    return result?.ConversionRate;
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to fetch Conversion Rate from external API.");
            }

            return null;
        }
    }
}
