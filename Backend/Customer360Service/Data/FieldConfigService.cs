using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using backend.Infrastructure;
using backend.Models;

namespace backend.Data
{
    /// <summary>
    /// CRUD + first-boot seeding for the field-visibility/masking config the Customer 360 detail
    /// pages now render from. Seeding is idempotent — it only ever inserts into an EMPTY table for a
    /// given ProfileType, so an admin's live edits are never overwritten by a later deploy that
    /// happens to run this again.
    /// </summary>
    public class FieldConfigService
    {
        private readonly Customer360DbContext _db;

        public FieldConfigService(Customer360DbContext db)
        {
            _db = db;
        }

        public async Task<List<FieldConfig>> GetByProfileTypeAsync(ProfileType profileType)
        {
            return await _db.FieldConfigs
                .AsNoTracking()
                .Where(f => f.ProfileType == profileType)
                .OrderBy(f => f.DisplayOrder)
                .ToListAsync();
        }

        /// <summary>Full-replace update for one profile type's field list — the admin UI always sends
        /// the complete edited set, not a partial patch, so this simply re-syncs the table to match
        /// (updates fields it already knows by ApiField, adds any new ones sent, and DOES NOT delete
        /// anything not present since a field the CRM stops sending is still legitimate to keep
        /// configured for if it comes back).</summary>
        public async Task<List<FieldConfig>> ReplaceAsync(ProfileType profileType, List<FieldConfig> incoming)
        {
            var existing = await _db.FieldConfigs
                .Where(f => f.ProfileType == profileType)
                .ToDictionaryAsync(f => f.ApiField, StringComparer.OrdinalIgnoreCase);

            foreach (var field in incoming)
            {
                if (existing.TryGetValue(field.ApiField, out var row))
                {
                    row.DisplayLabel = field.DisplayLabel;
                    row.Visible = field.Visible;
                    row.Section = field.Section;
                    row.DisplayOrder = field.DisplayOrder;
                    row.Sensitive = field.Sensitive;
                    row.MaskingRule = field.Sensitive ? field.MaskingRule : MaskingRule.None;
                    row.VisibleCharCount = field.VisibleCharCount;
                }
                else
                {
                    _db.FieldConfigs.Add(new FieldConfig
                    {
                        ProfileType = profileType,
                        ApiField = field.ApiField,
                        DisplayLabel = field.DisplayLabel,
                        Visible = field.Visible,
                        Section = field.Section,
                        DisplayOrder = field.DisplayOrder,
                        Sensitive = field.Sensitive,
                        MaskingRule = field.Sensitive ? field.MaskingRule : MaskingRule.None,
                        VisibleCharCount = field.VisibleCharCount,
                    });
                }
            }

            await _db.SaveChangesAsync();
            return await GetByProfileTypeAsync(profileType);
        }

        public async Task EnsureSeededAsync()
        {
            if (!await _db.FieldConfigs.AnyAsync(f => f.ProfileType == ProfileType.Individual))
            {
                _db.FieldConfigs.AddRange(BuildIndividualDefaults());
            }
            if (!await _db.FieldConfigs.AnyAsync(f => f.ProfileType == ProfileType.Corporate))
            {
                _db.FieldConfigs.AddRange(BuildCorporateDefaults());
            }
            await _db.SaveChangesAsync();
        }

        /// <summary>
        /// Exactly the field set/labels/sections the UI hardcoded before this feature existed
        /// (IndividualDetails.tsx), turned into config rows — so the very first boot renders
        /// identically to today, and every future change happens through the admin screen instead of
        /// a code deploy. Two deliberate, minor cleanups versus the old hardcoded version, both
        /// noted here rather than silently: "Phone Number" used to be duplicated verbatim under both
        /// Personal Details and Contact Details (same underlying value, same reveal state) — kept
        /// once, under Contact Details, its more natural home. Sensitive fields default to
        /// HideFirstShowLast/4 (a standard "last 4 digits" convention) rather than each field's old,
        /// mutually-inconsistent hand-rolled reveal count — an admin can change any of this from the
        /// new Field Settings screen at any time.
        /// </summary>
        private static List<FieldConfig> BuildIndividualDefaults()
        {
            var rows = new List<(string Field, string Label, string Section, bool Sensitive)>
            {
                ("gender", "Gender", "Personal Details", false),
                ("birthDate", "Date of Birth", "Personal Details", false),
                ("race", "Race", "Personal Details", false),
                ("religion", "Religion", "Personal Details", false),
                ("bumiStatus", "Bumi Status", "Personal Details", false),
                ("educationLevel", "Higher Education Level", "Personal Details", false),
                ("hnwi", "HNW Individual - Indicator", "Personal Details", false),
                ("pep", "NRIC/Political Person", "Personal Details", false),
                ("status", "Marital Status", "Personal Details", false),
                ("disabilityStatus", "Disability Status", "Personal Details", false),
                ("branch", "Customer Branch", "Personal Details", false),
                ("pdpaTag", "PDPA", "Personal Details", false),
                ("phprId", "CIF", "Personal Details", false),
                ("nationalId", "Primary ID Number", "Personal Details", true),
                ("oldId", "Secondary ID Number", "Personal Details", true),
                ("passport", "Passport Number", "Personal Details", true),
                ("languagePreferred", "Preferred Language", "Personal Details", false),
                ("mybsnInd", "MyBsn Active", "Personal Details", false),
                ("vipTagging", "VIP Tagging", "Personal Details", false),

                ("placeBirth", "Place of Birth", "Residency Details", false),
                ("citizenship", "Citizenship", "Residency Details", false),
                ("resdCode", "Resident / Non Resident Indicator", "Residency Details", false),
                ("contact.fixedAddress", "Residency Address", "Residency Details", false),

                ("contact.padrEmail1", "Email", "Contact Details", false),
                ("contact.contactNumber", "Phone", "Contact Details", true),
                ("preferComChnl", "Preferred Communication Channel", "Contact Details", false),
                ("marketMessageOpt", "Marketing Message Opt-In/Out", "Contact Details", false),

                ("jobStatus", "Employment Status", "Employment Details", false),
                ("employerName", "Employer Company Name", "Employment Details", false),
                ("employerPhone", "Employer Phone", "Employment Details", false),
                ("employerEmail", "Employer Email", "Employment Details", false),
                ("payrollInd", "Payroll Indicator", "Employment Details", false),
                ("designation", "Designation", "Employment Details", false),
                ("occupation", "Occupation", "Employment Details", false),
                ("industry", "Industry", "Employment Details", false),
                ("annualIncome", "Income Range (Annual/Yearly)", "Employment Details", false),
                ("employerAddress", "Employer Address", "Employment Details", false),

                ("openingDate", "Customer Onboarding Date", "Additional Details", false),
                ("turnedNonResidentDate", "Turned Non-Resident On Date", "Additional Details", false),
                ("lastContactDate", "Last Contact Date", "Additional Details", false),
                ("flags", "Customer Flags/Notes", "Additional Details", false),
                ("segmentation", "Customer Segmentation", "Additional Details", false),

                ("refEmployeeName", "Referrer Employee Name", "Referrer & Relationship Information", false),
                ("refEmployeeEmail", "Referrer Employee Email", "Referrer & Relationship Information", false),
                ("refEmployeeId", "Referrer Employee ID", "Referrer & Relationship Information", false),
            };

            return ToFieldConfigs(ProfileType.Individual, rows);
        }

        /// <summary>
        /// The corporate field list actually rendered inline in Customer360.tsx's four
        /// Non-Individual sub-tabs (Company Overview / Company Information / Contact &amp;
        /// Relationship / RM Manager) — NOT the separate CompanyOverview.tsx component, which turned
        /// out to be dead code (imported but never rendered anywhere), so it was not used as the
        /// source of truth here.
        /// </summary>
        private static List<FieldConfig> BuildCorporateDefaults()
        {
            var rows = new List<(string Field, string Label, string Section, bool Sensitive)>
            {
                ("organizationType", "Type of Organization", "Company Details", false),
                ("country", "Country of Incorporation", "Company Details", false),

                ("onlineBankingRegistrationStatus", "Online Banking Registration Status", "Online Banking Status", false),
                ("onlineBankingActivationStatus", "Online Banking Activation Status", "Online Banking Status", false),

                ("businessRegDate", "Date of Business Registration", "Business Registration", false),
                ("openingDate", "Organization Onboarding Date", "Business Registration", false),

                ("organizationName", "Organization Name", "Company Information", false),
                ("brn", "Old Business Registration Number (BRN)", "Company Information", false),
                ("brn2", "New Business Registration Number (BRN)", "Company Information", false),
                ("economicSector", "Economic Sector", "Company Information", false),
                ("companyWebsite", "Company Website", "Company Information", false),
                ("tin", "Tax Identification Number", "Company Information", true),
                ("cifNumber", "CIF Number", "Company Information", false),
                ("annualIncome", "Annual Income", "Company Information", false),
                ("residentType", "Resident Type", "Company Information", false),
                ("residentAddress", "Resident Address", "Company Information", false),

                ("contact.padrEmail1", "Email", "Contact Information", false),
                ("contact.contactNumber", "Phone Number", "Contact Information", true),
                ("marketMessageOpt", "Marketing Message Opt-In/Out", "Contact Information", false),
                ("contact.fixedAddress", "Address", "Contact Information", false),

                ("refEmployeeName", "Referrer Employee Name", "Referrer & Relationship Information", false),
                ("refEmployeeEmail", "Referrer Employee Email", "Referrer & Relationship Information", false),
                ("refEmployeePhoneNo", "Referrer Employee Phone Number", "Referrer & Relationship Information", false),
                ("refStaffId", "Staff ID", "Referrer & Relationship Information", false),

                ("rmName", "RM Name", "RM Manager Information", false),
                ("rmId", "RM ID", "RM Manager Information", false),
                ("rmBranchCode", "RM Branch Code", "RM Manager Information", false),
                ("rmContactNo", "RM Contact Number", "RM Manager Information", false),
            };

            return ToFieldConfigs(ProfileType.Corporate, rows);
        }

        private static List<FieldConfig> ToFieldConfigs(
            ProfileType profileType,
            List<(string Field, string Label, string Section, bool Sensitive)> rows)
        {
            var order = 0;
            return rows.Select(r => new FieldConfig
            {
                ProfileType = profileType,
                ApiField = r.Field,
                DisplayLabel = r.Label,
                Section = r.Section,
                DisplayOrder = ++order,
                Visible = true,
                Sensitive = r.Sensitive,
                MaskingRule = r.Sensitive ? MaskingRule.HideFirstShowLast : MaskingRule.None,
                VisibleCharCount = 4,
            }).ToList();
        }
    }
}
