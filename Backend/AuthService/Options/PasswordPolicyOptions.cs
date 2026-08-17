namespace AuthService.Options;

/// <summary>
/// Password rules, in configuration rather than in source so a deploying bank can tighten them to
/// match its own policy without a rebuild. Bound from the "PasswordPolicy" section.
///
/// The defaults follow common Indian banking practice for staff console credentials: at least 12
/// characters with all four character classes. They are deliberately stricter than the ASP.NET
/// Identity defaults, and the seeder's temporary-password generator must keep satisfying them.
/// </summary>
public class PasswordPolicyOptions
{
    public const string SectionName = "PasswordPolicy";

    public int MinimumLength { get; set; } = 12;

    /// <summary>
    /// Upper bound, so a caller cannot use the hashing work factor as a denial-of-service vector by
    /// submitting a multi-megabyte password. PBKDF2 cost scales with input length.
    /// </summary>
    public int MaximumLength { get; set; } = 128;

    public bool RequireUppercase { get; set; } = true;
    public bool RequireLowercase { get; set; } = true;
    public bool RequireDigit { get; set; } = true;
    public bool RequireNonAlphanumeric { get; set; } = true;

    /// <summary>
    /// Reject a new password identical to the current one. Not a full history check — storing past
    /// hashes to compare against is its own decision, and this catches the common case of a user
    /// "changing" a password to itself to satisfy a rotation prompt.
    /// </summary>
    public bool RejectSameAsCurrent { get; set; } = true;

    /// <summary>
    /// Human-readable description of the rules, for the API's validation message. Built from the
    /// options themselves so it can never drift from what is actually enforced.
    /// </summary>
    public string Describe()
    {
        var parts = new List<string> { $"at least {MinimumLength} characters" };
        if (RequireUppercase) parts.Add("an uppercase letter");
        if (RequireLowercase) parts.Add("a lowercase letter");
        if (RequireDigit) parts.Add("a digit");
        if (RequireNonAlphanumeric) parts.Add("a symbol");

        return parts.Count == 1
            ? $"Password must be {parts[0]}."
            : $"Password must contain {string.Join(", ", parts.Take(parts.Count - 1))} and {parts[^1]}.";
    }

    /// <summary>Returns null when the candidate satisfies the policy, or the reason it doesn't.</summary>
    public string? Validate(string password)
    {
        if (string.IsNullOrWhiteSpace(password)) return "Password is required.";
        if (password.Length < MinimumLength || password.Length > MaximumLength) return Describe();
        if (RequireUppercase && !password.Any(char.IsUpper)) return Describe();
        if (RequireLowercase && !password.Any(char.IsLower)) return Describe();
        if (RequireDigit && !password.Any(char.IsDigit)) return Describe();
        if (RequireNonAlphanumeric && password.All(char.IsLetterOrDigit)) return Describe();
        return null;
    }
}
