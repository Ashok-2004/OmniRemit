using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text.Json;
using backend.Models;

namespace backend.Data
{
    public class AuditRepository
    {
        private readonly string _filePath;
        private readonly List<AuditLog> _logs = new();
        private readonly object _lock = new();

        public AuditRepository()
        {
            // Store logs in the backend directory
            _filePath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "audit_logs.json");
            LoadLogs();
        }

        private void LoadLogs()
        {
            lock (_lock)
            {
                try
                {
                    if (File.Exists(_filePath))
                    {
                        var json = File.ReadAllText(_filePath);
                        if (!string.IsNullOrWhiteSpace(json))
                        {
                            var deserialized = JsonSerializer.Deserialize<List<AuditLog>>(json);
                            if (deserialized != null)
                            {
                                _logs.Clear();
                                _logs.AddRange(deserialized);
                            }
                        }
                    }
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"Error loading audit logs: {ex.Message}");
                }
            }
        }

        private void SaveLogs()
        {
            lock (_lock)
            {
                try
                {
                    var json = JsonSerializer.Serialize(_logs, new JsonSerializerOptions { WriteIndented = true });
                    File.WriteAllText(_filePath, json);
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"Error saving audit logs: {ex.Message}");
                }
            }
        }

        public void Add(AuditLog log)
        {
            lock (_lock)
            {
                _logs.Insert(0, log); // Insert newest at the beginning
                SaveLogs();
            }
        }

        public List<AuditLog> Get(string? search, string? action, int pageNumber, int pageSize, out int totalCount)
        {
            lock (_lock)
            {
                IEnumerable<AuditLog> query = _logs;

                // 1. Action Filter (case-insensitive, ignores "All Actions")
                if (!string.IsNullOrWhiteSpace(action) && !action.Equals("All Actions", StringComparison.OrdinalIgnoreCase))
                {
                    if (action.Equals("VIEW", StringComparison.OrdinalIgnoreCase))
                    {
                        query = query.Where(l => l.Action.StartsWith("VIEW", StringComparison.OrdinalIgnoreCase));
                    }
                    else
                    {
                        query = query.Where(l => l.Action.Equals(action, StringComparison.OrdinalIgnoreCase));
                    }
                }

                // 2. Search query (case-insensitive matching on user, description, or status)
                if (!string.IsNullOrWhiteSpace(search))
                {
                    var searchLower = search.ToLowerInvariant();
                    query = query.Where(l => 
                        (l.User != null && l.User.ToLowerInvariant().Contains(searchLower)) ||
                        (l.Description != null && l.Description.ToLowerInvariant().Contains(searchLower)) ||
                        (l.Status != null && l.Status.ToLowerInvariant().Contains(searchLower))
                    );
                }

                var list = query.ToList();
                totalCount = list.Count;

                // 3. Paginate
                return list
                    .Skip((pageNumber - 1) * pageSize)
                    .Take(pageSize)
                    .ToList();
            }
        }
    }
}
