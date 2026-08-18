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

        // NOTE ON SCALE: this repository is still a local file, not a database — audit history lives in
        // this one process's memory and on its local disk. On a platform like Render that disk is
        // ephemeral, so every redeploy silently loses whatever audit history had accumulated; there is
        // also no multi-instance story (two replicas would each keep a separate, diverging file). For a
        // bank-facing compliance/audit trail, the durable fix is a real database table (matching how
        // AuthService already persists its own audit log), not a bigger file. What IS fixed here is the
        // one part that was actively getting WORSE as history grew:
        private void LoadLogs()
        {
            lock (_lock)
            {
                try
                {
                    if (!File.Exists(_filePath)) return;
                    var text = File.ReadAllText(_filePath);
                    if (string.IsNullOrWhiteSpace(text)) return;

                    if (text.TrimStart().StartsWith('['))
                    {
                        // Legacy format from before the fix below: the whole history as one JSON array,
                        // rewritten in full on every write. Read whatever is already on disk once here —
                        // it was saved newest-first (see the old Insert(0, ...) below), so no reordering
                        // needed — and every write from now on appends instead.
                        var deserialized = JsonSerializer.Deserialize<List<AuditLog>>(text);
                        if (deserialized != null) _logs.AddRange(deserialized);
                        return;
                    }

                    // Current format: newline-delimited JSON, one record per line, appended oldest-last.
                    // Parse in file order then reverse once, so in-memory order matches the newest-first
                    // convention every reader of `_logs` already relies on.
                    var parsed = new List<AuditLog>();
                    foreach (var line in text.Split('\n'))
                    {
                        var trimmedLine = line.Trim();
                        if (trimmedLine.Length == 0) continue;
                        var log = JsonSerializer.Deserialize<AuditLog>(trimmedLine);
                        if (log != null) parsed.Add(log);
                    }
                    parsed.Reverse();
                    _logs.AddRange(parsed);
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"Error loading audit logs: {ex.Message}");
                }
            }
        }

        public void Add(AuditLog log)
        {
            lock (_lock)
            {
                _logs.Insert(0, log); // Newest first in memory — every reader of `_logs` relies on this.
                try
                {
                    // Append-only write: one line, O(1) regardless of how much history already exists.
                    // The previous version re-serialized and rewrote the ENTIRE log on every single
                    // write (SaveLogs() below used to run here) — at real audit-log volume (thousands of
                    // events a day, every day) that per-write cost grows without bound, and it holds the
                    // single lock on this repository for the whole rewrite, serializing every other
                    // request that wants to read or write a log in the meantime.
                    File.AppendAllText(_filePath, JsonSerializer.Serialize(log) + "\n");
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"Error saving audit log: {ex.Message}");
                }
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
