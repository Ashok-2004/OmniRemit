using System;
using System.Collections.Generic;
using System.Reflection;
using System.Text.Json;
using System.Text.Json.Serialization;
using backend.Models;

namespace backend.Data
{
    public class DualNamingConverterFactory : JsonConverterFactory
    {
        private static readonly HashSet<Type> TargetTypes = new()
        {
            typeof(IndividualProfile),
            typeof(CorporateProfile),
            typeof(CustomerProduct),
            typeof(Interaction),
            typeof(ContactDetail),
            typeof(DepositProduct),
            typeof(LoanProduct),
            typeof(CardsProduct),
            typeof(GoldProduct),
            typeof(WmProduct),
            typeof(UnitTrustProduct),
            typeof(WillWritingProduct)
        };

        public override bool CanConvert(Type typeToConvert)
        {
            return TargetTypes.Contains(typeToConvert);
        }

        public override JsonConverter CreateConverter(Type typeToConvert, JsonSerializerOptions options)
        {
            var converterType = typeof(DualNamingConverter<>).MakeGenericType(typeToConvert);
            return (JsonConverter)Activator.CreateInstance(converterType)!;
        }
    }

    public class DualNamingConverter<T> : JsonConverter<T> where T : class
    {
        private static readonly Dictionary<string, string> NameMappings = new(StringComparer.OrdinalIgnoreCase)
        {
            // IndividualProfile
            { "IndividualProfile.PhprId", "PHPR ID" },
            { "IndividualProfile.FullName", "fulL_NAME" },
            { "IndividualProfile.BirthDate", "birtH_DATE" },
            { "IndividualProfile.PlaceBirth", "placE_BIRTH" },
            { "IndividualProfile.NationalId", "nationaL_ID" },
            { "IndividualProfile.BirthCertificate", "birtH_CERTIFICATE" },
            { "IndividualProfile.OldId", "olD_ID" },
            { "IndividualProfile.PoliceNumber", "policE_NUMBER" },
            { "IndividualProfile.OpeningDate", "openinG_DATE" },
            { "IndividualProfile.LanguagePreferred", "languagE_PREFFERED" },
            { "IndividualProfile.BranchCode", "brancH_CODE" },
            { "IndividualProfile.JobStatus", "joB_STATUS" },
            { "IndividualProfile.EmployerName", "employeR_NAME" },
            { "IndividualProfile.EmployerPhone", "employeR_PHONE" },
            { "IndividualProfile.EmployerAddress", "employeR_ADDRESS" },
            { "IndividualProfile.PdpaTag", "pdpA_TAG" },
            { "IndividualProfile.BumiStatus", "bumI_STATUS" },
            { "IndividualProfile.EducationLevel", "educatioN_LEVEL" },
            { "IndividualProfile.AnnualIncome", "annuaL_INCOME" },
            { "IndividualProfile.PayrollInd", "payrolL_IND" },
            { "IndividualProfile.MybsnInd", "mybsN_IND" },
            { "IndividualProfile.LastModDate", "lasT_MOD_DATE" },
            { "IndividualProfile.TurnedNonResidentDate", "turneD_NON_RESIDENT_DATE" },
            { "IndividualProfile.DisabilityStatus", "disabilitY_STATUS" },
            { "IndividualProfile.EmployerEmail", "employeR_EMAIL" },
            { "IndividualProfile.PreferComChnl", "prefeR_COM_CHNL" },
            { "IndividualProfile.MarketMessageOpt", "markeT_MESSAGE_OPT" },
            { "IndividualProfile.ServiceMessage", "servicE_MESSAGE" },
            { "IndividualProfile.InterestedProduct", "interesteD_PRODUCT" },
            { "IndividualProfile.InterestedProductName", "interesteD_PRODUCT_NAME" },
            { "IndividualProfile.InterestedProductCategory", "interesteD_PRODUCT_CATEGORY" },
            { "IndividualProfile.RefEmployeeName", "reF_EMPLOYEE_NAME" },
            { "IndividualProfile.RefEmployeeEmail", "reF_EMPLOYEE_EMAIL" },
            { "IndividualProfile.CrgDetails", "crG_DETAILS" },
            { "IndividualProfile.RmName", "rM_NAME" },
            { "IndividualProfile.RmId", "rM_ID" },
            { "IndividualProfile.RmBranchCode", "rM_BRANCH_CODE" },
            { "IndividualProfile.RmContactNo", "rM_CONTACT_NO" },
            { "IndividualProfile.ProfilePic", "profilE_PIC" },
            { "IndividualProfile.LastContactDate", "lasT_CONTACT_DATE" },
            { "IndividualProfile.PrevCustomerInter", "preV_CUSTOMER_INTER" },
            { "IndividualProfile.CurrentRm", "currenT_RM" },
            { "IndividualProfile.LastContactDateRm", "lasT_CONTACT_DATE_RM" },
            { "IndividualProfile.EmploymentReligion", "employmenT_RELIGION" },
            { "IndividualProfile.EmploymentBumiStatus", "employmenT_BUMI_STATUS" },
            { "IndividualProfile.CampaignCode", "campaigN_CODE" },
            { "IndividualProfile.PositionDate", "positioN_DATE" },
            { "IndividualProfile.ResdCode", "resD_CODE" },
            { "IndividualProfile.EngagementCount", "engagemenT_COUNT" },
            { "IndividualProfile.EligibilityScore", "eligibilitY_SCORE" },
            { "IndividualProfile.RefEmployeeId", "reF_EMPLOYEE_ID" },

            // CorporateProfile
            { "CorporateProfile.CifNumber", "ciF_NUMBER" },
            { "CorporateProfile.CustomerId", "customeR_ID" },
            { "CorporateProfile.OrganizationName", "organizatioN_NAME" },
            { "CorporateProfile.BusinessRegDate", "businesS_REG_DATE" },
            { "CorporateProfile.OrganizationType", "organizatioN_TYPE" },
            { "CorporateProfile.EconomicSector", "economiC_SECTOR" },
            { "CorporateProfile.ResidentType", "residenT_TYPE" },
            { "CorporateProfile.Brn2", "brN2" },
            { "CorporateProfile.LastModifyDate", "lasT_MODIFY_DATE" },
            { "CorporateProfile.OnlineBankingRegistrationStatus", "onlinE_BANKING_REGISTRATION_STATUS" },
            { "CorporateProfile.OnlineBankingActivationStatus", "onlinE_BANKING_ACTIVATION_STATUS" },
            { "CorporateProfile.ResidentAddress", "residenT_ADDRESS" },
            { "CorporateProfile.AnnualIncome", "annuaL_INCOME" },
            { "CorporateProfile.SignatoryName", "signatorY_NAME" },
            { "CorporateProfile.CompanyWebsite", "companY_WEBSITE" },
            { "CorporateProfile.PayrollIndic", "payrolL_INDIC" },
            { "CorporateProfile.MarketMessageOpt", "markeT_MESSAGE_OPT" },
            { "CorporateProfile.ServiceMessage", "servicE_MESSAGE" },
            { "CorporateProfile.InterestedProduct", "interesteD_PRODUCT" },
            { "CorporateProfile.InterestedProductName", "interesteD_PRODUCT_NAME" },
            { "CorporateProfile.InterestedProductCategory", "interesteD_PRODUCT_CATEGORY" },
            { "CorporateProfile.CampaignEligibleA", "campaigN_ELIGIBLE_A" },
            { "CorporateProfile.CampaignEligibleB", "campaigN_ELIGIBLE_B" },
            { "CorporateProfile.LastContactDate", "lasT_CONTACT_DATE" },
            { "CorporateProfile.LifecycleTrig", "lifecyclE_TRIG" },
            { "CorporateProfile.RefEmployeeName", "reF_EMPLOYEE_NAME" },
            { "CorporateProfile.RefEmployeeEmail", "reF_EMPLOYEE_EMAIL" },
            { "CorporateProfile.RefEmployeePhoneNo", "reF_EMPLOYEE_PHONE_NO" },
            { "CorporateProfile.RefStaffId", "reF_STAFF_ID" },
            { "CorporateProfile.RmName", "rM_NAME" },
            { "CorporateProfile.RmId", "rM_ID" },
            { "CorporateProfile.RmBranchCode", "rM_BRANCH_CODE" },
            { "CorporateProfile.RmContactNo", "rM_CONTACT_NO" },
            { "CorporateProfile.ProfilePic", "profilE_PIC" },
            { "CorporateProfile.PositionDate", "positioN_DATE" },
            { "CorporateProfile.OpeningDate", "openinG_DATE" },
            { "CorporateProfile.SignatoryDateOfBirth", "signatorY_DATE_OF_BIRTH" },
            { "CorporateProfile.SignatoryIdNumber", "signatorY_ID_NUMBER" },
            { "CorporateProfile.SignatoryPhoneNumber", "signatorY_PHONE_NUMBER" },
            { "CorporateProfile.SignatoryPosition", "signatorY_POSITION" },
            { "CorporateProfile.EngagementCount", "engagemenT_COUNT" },
            { "CorporateProfile.EligibilityScore", "eligibilitY_SCORE" },

            // CustomerProduct
            { "CustomerProduct.PhprId", "phpR_ID" },
            { "CustomerProduct.ProductCategory", "producT_CATEGORY" },
            { "CustomerProduct.ProductName", "PRODUCT NAME" },
            { "CustomerProduct.AccountNumber", "ACCOUNT NUMBER" },
            { "CustomerProduct.MaturityDate", "MATURITY DATE" },
            { "CustomerProduct.DerivedAccountStatus", "deriveD_ACCOUNT_STATUS" },
            { "CustomerProduct.FinancingStatus", "financinG_STATUS" },
            { "CustomerProduct.CardStatus", "carD_STATUS" },
            { "CustomerProduct.CertStatus", "cerT_STATUS" },
            { "CustomerProduct.GoldStatus", "golD_STATUS" },
            { "CustomerProduct.CardType", "CARD TYPE" },
            { "CustomerProduct.CampaignCode", "campaigN_CODE" },
            { "CustomerProduct.LastContactDate", "lasT_CONTACT_DATE" },
            { "CustomerProduct.AccountOpeningDate", "ACCOUNT OPENING DATE" },
            { "CustomerProduct.CardIssuanceDate", "CARD ISSUANCE DATE" },
            { "CustomerProduct.CreatedDate", "CREATED DATE" },
            { "CustomerProduct.CommencementDate", "COMMENCEMENT DATE" },
            { "CustomerProduct.DisbursedDate", "disburseD_DATE" },
            { "CustomerProduct.TarikhDaftarWasiat", "tarikH_DAFTAR_WASIAT" },

            // Interaction
            { "Interaction.PositionDate", "positioN_DATE" },
            { "Interaction.SubCategory1", "subcategorY1" },
            { "Interaction.SubCategory2", "subcategorY2" },
            { "Interaction.StatusParent", "statuS_PARENT" },
            { "Interaction.StatusChild", "statuS_CHILD" },
            { "Interaction.SourceName", "sourcename" },
            { "Interaction.StateName", "statename" },
            { "Interaction.ChannelToSubRoleId", "channeltO_SUBROLEID" },
            { "Interaction.SubRoleName", "subrolename" },
            { "Interaction.RequireEscalation", "requirE_ESCALATION" },
            { "Interaction.CreatedByParent", "createdbY_PARENT" },
            { "Interaction.CreatedDateParent", "createddatE_PARENT" },
            { "Interaction.ModifiedByParent", "modifiedbY_PARENT" },
            { "Interaction.CreatedByChild", "createdbY_CHILD" },
            { "Interaction.CreatedDateChild", "createddatE_CHILD" },
            { "Interaction.ModifiedByChild", "modifiedbY_CHILD" },
            { "Interaction.ActionSummary", "actioN_SUMMARY" },
            { "Interaction.ActionDetails", "actioN_DETAILS" },
            { "Interaction.NewAccNo", "neW_ACC_NO" },
            { "Interaction.OldAccNo", "olD_ACCNO" },
            { "Interaction.CustomerName", "customeR_NAME" },
            { "Interaction.ContactNo", "contacT_NO" },
            { "Interaction.ChannelTo", "channeL_TO" },
            { "Interaction.CalendarDays", "calendaR_DAYS" },
            { "Interaction.BusinessDays", "businesS_DAYS" },
            { "Interaction.BnmName", "bnM_NAME" },
            { "Interaction.MofName", "moF_NAME" },
            { "Interaction.CusBranchHqName", "cuS_BRANCH_HQNAME" },
            { "Interaction.CusBranchName", "cuS_BRANCH_NAME" },
            { "Interaction.CusRoleId", "cuS_ROLE_ID" },

            // ContactDetail
            { "ContactDetail.PartyId", "partY_ID" },
            { "ContactDetail.FixedAddress", "fixeD_ADDRESS" },
            { "ContactDetail.MailingAddress", "mailinG_ADDRESS" },
            { "ContactDetail.PadrEmail1", "padR_E_MAIL_1" },
            { "ContactDetail.PadrEmail2", "padR_E_MAIL_2" },
            { "ContactDetail.ContactNumber", "contacT_NUMBER" },
            { "ContactDetail.NricBrn", "NRIC BRN" },
            { "ContactDetail.PadrLastModDate", "padR_LAST_MOD_DATE" },
            { "ContactDetail.PositionDate", "positioN_DATE" },

            // DepositProduct
            { "DepositProduct.PositionDate", "POSITION DATE" },
            { "DepositProduct.ProductCode", "PRODUCT CODE" },
            { "DepositProduct.ProductCategory", "producT_CATEGORY" },
            { "DepositProduct.ProductName", "PRODUCT NAME" },
            { "DepositProduct.ProductDescription", "PRODUCT DESCRIPTION" },
            { "DepositProduct.AccountNumber", "ACCOUNT NUMBER" },
            { "DepositProduct.DerivedAccountStatus", "DERIVED ACCOUNT STATUS" },
            { "DepositProduct.BlockingReasons", "blockinG_REASONS" },
            { "DepositProduct.AccountOpeningDate", "ACCOUNT OPENING DATE" },
            { "DepositProduct.AccountPurposes", "ACCOUNT PURPOSES" },
            { "DepositProduct.BranchAccount", "BRANCH ACCOUNT" },
            { "DepositProduct.StateAccount", "STATE ACCOUNT" },
            { "DepositProduct.PlacementAmount", "PLACEMENT AMOUNT" },
            { "DepositProduct.MaturityDate", "MATURITY DATE" },
            { "DepositProduct.HsmmRates", "HSMM RATES" },
            { "DepositProduct.MaturityInstruction", "MATURITY INSTRUCTION" },
            { "DepositProduct.CreditingCasaAccountNo", "CREDITING CASA ACCOUNT NO" },
            { "DepositProduct.RnCerd", "rN_CERD" },
            { "DepositProduct.CerdPurchaseDate", "CERD PURCHASE DATE" },
            { "DepositProduct.CerdSerialNo", "CERD SERIAL NO" },
            { "DepositProduct.CerdFromCertNum", "CERD FROM CERT NUM" },
            { "DepositProduct.CerdToCertNum", "CERD TO CERT NUM" },
            { "DepositProduct.CerdNoOfUnits", "CERD NO OF UNITS" },
            { "DepositProduct.CustomerName", "CUSTOMER NAME" },
            { "DepositProduct.PhprId", "phpR_ID" },
            { "DepositProduct.CustId", "cusT_ID" },
            { "DepositProduct.LastTransactionDate", "lasT_TRANSACTION_DATE" },
            { "DepositProduct.OldAccountNo", "olD_ACCOUNT_NO" },

            // LoanProduct
            { "LoanProduct.PositionDate", "POSITION DATE" },
            { "LoanProduct.ProductCategory", "producT_CATEGORY" },
            { "LoanProduct.ProductName", "PRODUCT NAME" },
            { "LoanProduct.ProductDescription", "PRODUCT DESCRIPTION" },
            { "LoanProduct.AccountNo", "ACCOUNT NO" },
            { "LoanProduct.FinancingStatus", "FINANCING STATUS" },
            { "LoanProduct.FinancingAmount", "FINANCING AMOUNT" },
            { "LoanProduct.MonthlyInstallment", "MONTHLY INSTALLMENT" },
            { "LoanProduct.OriginalRate", "ORIGINAL RATE" },
            { "LoanProduct.CurrentRate", "CURRENT RATE" },
            { "LoanProduct.MaturityDate", "MATURITY DATE" },
            { "LoanProduct.DisbursedDate", "disburseD_DATE" },
            { "LoanProduct.VehicleModel", "VEHICLE MODEL" },
            { "LoanProduct.PropertyType", "PROPERTY TYPE" },
            { "LoanProduct.PropertyValuePrice", "PROPERTY VALUE PRICE" },
            { "LoanProduct.PropertyAddress", "PROPERTY ADDRESS" },
            { "LoanProduct.PhprId", "phpR_ID" },
            { "LoanProduct.MrprId", "mrpR_ID" },
            { "LoanProduct.CustId", "cusT_ID" },
            { "LoanProduct.IlomSeq", "iloM_SEQ" },
            { "LoanProduct.PayOffAmount", "paY_OFF_AMOUNT" },
            { "LoanProduct.TitleNo", "titlE_NO" },

            // CardsProduct
            { "CardsProduct.PositionDate", "POSITION DATE" },
            { "CardsProduct.CardType", "CARD TYPE" },
            { "CardsProduct.CardTypeDesc", "CARD TYPE DESC" },
            { "CardsProduct.ProductCode", "PRODUCT CODE" },
            { "CardsProduct.ProductName", "PRODUCT NAME" },
            { "CardsProduct.AccountNo", "ACCOUNT NO" },
            { "CardsProduct.CreditLimit", "CREDIT LIMIT" },
            { "CardsProduct.CurrentDue", "CURRENT DUE" },
            { "CardsProduct.CardStatus", "CARD STATUS" },
            { "CardsProduct.ProfitInterestRate", "PROFIT INTEREST RATE" },
            { "CardsProduct.CardIssuanceDate", "CARD ISSUANCE DATE" },
            { "CardsProduct.CardExpiredDate", "CARD EXPIRED DATE" },
            { "CardsProduct.CardBlk", "CARD BLK" },
            { "CardsProduct.CardBlkDate", "cardblK_DATE" },
            { "CardsProduct.CustName", "custname" },
            { "CardsProduct.InstalmentPlansTag", "INSTALMENT PLANS TAG" },
            { "CardsProduct.LastPaymentDate", "LAST PAYMENT DATE" },
            { "CardsProduct.CardNo", "CARD NO" },
            { "CardsProduct.OriginalRate", "originaL_RATE" },
            { "CardsProduct.CurrentRate", "CURRENT RATE" },
            { "CardsProduct.PayOffAmount", "PAY OFF AMOUNT" },
            { "CardsProduct.ProductCategory", "producT_CATEGORY" },
            { "CardsProduct.CasaBalance", "casabalance" },

            // GoldProduct
            { "GoldProduct.PositionDate", "POSITION DATE" },
            { "GoldProduct.GoldAccountNo", "GOLD ACCOUNT No" },
            { "GoldProduct.AccountType", "ACCOUNT TYPE" },
            { "GoldProduct.CreatedDate", "CREATED DATE" },
            { "GoldProduct.XauBalance", "XAU BALANCE (Gram)" },
            { "GoldProduct.TotalAmount", "TOTAL AMOUNT (RM)" },
            { "GoldProduct.BankBuySell", "BANK BUY SELL" },
            { "GoldProduct.CustomerName", "CUSTOMER NAME" },
            { "GoldProduct.PrimaryIdNo", "PRIMARY ID NO" },

            // WmProduct
            { "WmProduct.PositionDate", "POSITION DATE" },
            { "WmProduct.ProductCategory", "producT_CATEGORY" },
            { "WmProduct.ProviderName", "PROVIDER NAME" },
            { "WmProduct.PolicyNo", "POLICY NO" },
            { "WmProduct.PlanName", "PLAN NAME" },
            { "WmProduct.BasicContributionAmount", "BASIC CONTRIBUTION AMOUNT" },
            { "WmProduct.CommencementDate", "COMMENCEMENT DATE" },
            { "WmProduct.CertificateStatus", "CERTIFICATE STATUs" },
            { "WmProduct.CustomerName", "CUSTOMER NAME" },
            { "WmProduct.PrimaryIdNumber", "PRIMARY ID NUMBER" },
            { "WmProduct.PaymentMode", "paymenT_MODE" },
            { "WmProduct.ExpiryDate", "expirY_DATE" },
            { "WmProduct.VehicleNo", "VEHICLE NO" },
            { "WmProduct.ProductDescription", "PRODUCT_DESCRIPTION" },

            // UnitTrustProduct
            { "UnitTrustProduct.InvestmentAccountNo", "investmenT_ACCOUNT_NO" },
            { "UnitTrustProduct.PositionDate", "positioN_DATE" },
            { "UnitTrustProduct.FundName", "funD_NAME" },
            { "UnitTrustProduct.UnitHoldings", "uniT_HOLDINGS" },
            { "UnitTrustProduct.CustomerName", "customeR_NAME" },

            // WillWritingProduct
            { "WillWritingProduct.WillWritingRefNo", "wilL_WRITING_REF_NO" },
            { "WillWritingProduct.PositionDate", "positioN_DATE" },
            { "WillWritingProduct.CustomerName", "customeR_NAME" },
            { "WillWritingProduct.ProductName", "PRODUCT NAME" },
            { "WillWritingProduct.TarikhDaftarWasiat", "tarikH_DAFTAR_WASIAT" }
        };

        public override T Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
        {
            throw new NotImplementedException("Deserialization not implemented for dual-naming.");
        }

        public override void Write(Utf8JsonWriter writer, T value, JsonSerializerOptions options)
        {
            writer.WriteStartObject();
            var typeName = typeof(T).Name;
            var properties = typeof(T).GetProperties(BindingFlags.Public | BindingFlags.Instance);
            
            foreach (var prop in properties)
            {
                if (prop.GetCustomAttribute<JsonIgnoreAttribute>() != null) continue;
                var val = prop.GetValue(value);
                
                // 1. Get standard camelCase name
                string camelName = JsonNamingPolicy.CamelCase.ConvertName(prop.Name);
                
                // 2. Get OpenAPI spec name based on mapping
                string mapKey = $"{typeName}.{prop.Name}";
                string openApiName = NameMappings.TryGetValue(mapKey, out var customName) ? customName : camelName;
                
                // Write standard camelCase key
                writer.WritePropertyName(camelName);
                JsonSerializer.Serialize(writer, val, prop.PropertyType, options);
                
                // Write OpenAPI custom key (if different from camelCase)
                if (openApiName != camelName)
                {
                    writer.WritePropertyName(openApiName);
                    JsonSerializer.Serialize(writer, val, prop.PropertyType, options);
                }
            }
            writer.WriteEndObject();
        }
    }
}
