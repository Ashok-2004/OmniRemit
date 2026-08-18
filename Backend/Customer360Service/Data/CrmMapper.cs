using System;
using System.Collections.Generic;
using System.Reflection;
using System.Text.Json;
using System.Text.RegularExpressions;

namespace backend.Data
{
    public static class JsonElementExtensions
    {
        public static bool TryGetPropertyCaseInsensitive(this JsonElement element, string name, out JsonElement value)
        {
            value = default;
            if (element.ValueKind != JsonValueKind.Object) return false;

            foreach (var prop in element.EnumerateObject())
            {
                if (string.Equals(prop.Name, name, StringComparison.OrdinalIgnoreCase))
                {
                    value = prop.Value;
                    return true;
                }
            }
            return false;
        }
    }

    public static class CrmMapper
    {
        private static string Normalize(string? input)
        {
            if (string.IsNullOrEmpty(input)) return string.Empty;
            // Strip spaces, underscores, dashes, and other non-alphanumeric chars
            var clean = Regex.Replace(input, @"[^a-zA-Z0-9]", "").ToLower();
            // Strip unit suffixes commonly returned in keys
            if (clean.EndsWith("rm")) clean = clean.Substring(0, clean.Length - 2);
            if (clean.EndsWith("gram")) clean = clean.Substring(0, clean.Length - 4);
            // Handle spelling variants
            if (clean == "languagepreferred" || clean == "languagepreffered") return "langpref";
            return clean;
        }

        public static T Map<T>(JsonElement element) where T : new()
        {
            var result = new T();
            var type = typeof(T);
            var properties = type.GetProperties(BindingFlags.Public | BindingFlags.Instance);

            foreach (var prop in properties)
            {
                if (!prop.CanWrite) continue;

                // Get normalized targets for property names and database Column attributes
                var normalizedTargets = new List<string> { Normalize(prop.Name) };
                var colAttr = prop.GetCustomAttribute<System.ComponentModel.DataAnnotations.Schema.ColumnAttribute>();
                if (colAttr != null)
                {
                    normalizedTargets.Add(Normalize(colAttr.Name));
                }

                // Match against JSON elements
                foreach (var jsonProp in element.EnumerateObject())
                {
                    var normalizedKey = Normalize(jsonProp.Name);
                    if (normalizedTargets.Contains(normalizedKey))
                    {
                        var value = jsonProp.Value;
                        if (value.ValueKind == JsonValueKind.Null)
                        {
                            prop.SetValue(result, null);
                        }
                        else if (prop.PropertyType == typeof(string))
                        {
                            if (value.ValueKind == JsonValueKind.String)
                                prop.SetValue(result, value.GetString());
                            else
                                prop.SetValue(result, value.ToString());
                        }
                        else if (prop.PropertyType == typeof(int) || prop.PropertyType == typeof(int?))
                        {
                            if (value.ValueKind == JsonValueKind.Number)
                                prop.SetValue(result, value.GetInt32());
                            else if (int.TryParse(value.ToString(), out int parsedInt))
                                prop.SetValue(result, parsedInt);
                        }
                        break;
                    }
                }
            }

            return result;
        }

        public static List<T> MapList<T>(JsonElement element) where T : new()
        {
            var list = new List<T>();
            if (element.ValueKind == JsonValueKind.Array)
            {
                foreach (var item in element.EnumerateArray())
                {
                    list.Add(Map<T>(item));
                }
            }
            return list;
        }
    }
}
