using Microsoft.EntityFrameworkCore;
using LeadManagement.Api.Models.Entities;

namespace LeadManagement.Api.Data;

public static class LeadDbSeeder
{
    public static async Task SeedAsync(ApplicationDbContext db)
    {
        if (await db.Leads.AnyAsync())
        {
            return;
        }

        var asbProduct = await db.Products.FirstOrDefaultAsync(p => p.Code == "ASB");
        var homeProduct = await db.Products.FirstOrDefaultAsync(p => p.Code == "HOME");
        var autoProduct = await db.Products.FirstOrDefaultAsync(p => p.Code == "AUTO");
        var personalProduct = await db.Products.FirstOrDefaultAsync(p => p.Code == "PERSONAL");
        var microProduct = await db.Products.FirstOrDefaultAsync(p => p.Code == "MICRO");

        var stateKl = await db.States.FirstOrDefaultAsync(s => s.Code == "KUL");
        var stateSel = await db.States.FirstOrDefaultAsync(s => s.Code == "SGL");
        var statePenang = await db.States.FirstOrDefaultAsync(s => s.Code == "PNG");
        var stateJohor = await db.States.FirstOrDefaultAsync(s => s.Code == "JHR");

        var branchKl01 = await db.Branches.FirstOrDefaultAsync(b => b.Code == "KL01");
        var branchKl02 = await db.Branches.FirstOrDefaultAsync(b => b.Code == "KL02");
        var branchSl01 = await db.Branches.FirstOrDefaultAsync(b => b.Code == "SL01");
        var branchPn01 = await db.Branches.FirstOrDefaultAsync(b => b.Code == "PN01");

        var execAzman = await db.SalesExecutives.FirstOrDefaultAsync(se => se.StaffId == "SE-1001");
        var execNoraini = await db.SalesExecutives.FirstOrDefaultAsync(se => se.StaffId == "SE-1002");
        var execKevin = await db.SalesExecutives.FirstOrDefaultAsync(se => se.StaffId == "SE-1003");

        if (asbProduct == null || stateKl == null)
        {
            return;
        }

        var now = DateTime.UtcNow;

        var sampleLeads = new List<Lead>
        {
            new()
            {
                Id = Guid.NewGuid(),
                LeadReference = $"LEAD-{now:yyyyMMdd}-1001",
                CustomerName = "Muhammad Haziq bin Yusof",
                IcNumber = "920415-14-5543",
                PhoneCountryCode = "+60",
                PhoneNumber = "+60 12-345 6789",
                Email = "haziq.yusof@gmail.com",
                ProductId = asbProduct.Id,
                StateId = stateKl.Id,
                BranchId = branchKl01?.Id,
                EmployerName = "Petronas Digital Sdn Bhd",
                AppliedAmount = 150000m,
                HasPreferredSalesExecutive = true,
                PreferredSalesExecutiveId = execAzman?.Id,
                Status = "Converted",
                CreatedAt = now.AddDays(-25),
                UpdatedAt = now.AddDays(-5),
            },
            new()
            {
                Id = Guid.NewGuid(),
                LeadReference = $"LEAD-{now:yyyyMMdd}-1002",
                CustomerName = "Tan Wei Lun",
                IcNumber = "881102-08-6123",
                PhoneCountryCode = "+60",
                PhoneNumber = "+60 16-789 1234",
                Email = "tan.weilun@techcorp.my",
                ProductId = homeProduct?.Id ?? asbProduct.Id,
                StateId = stateSel?.Id ?? stateKl.Id,
                BranchId = branchSl01?.Id,
                EmployerName = "Shopee Malaysia",
                AppliedAmount = 450000m,
                HasPreferredSalesExecutive = true,
                PreferredSalesExecutiveId = execKevin?.Id,
                Status = "In Progress",
                CreatedAt = now.AddDays(-18),
                UpdatedAt = now.AddDays(-2),
            },
            new()
            {
                Id = Guid.NewGuid(),
                LeadReference = $"LEAD-{now:yyyyMMdd}-1003",
                CustomerName = "Nurul Aisyah binti Abdullah",
                IcNumber = "950720-10-5892",
                PhoneCountryCode = "+60",
                PhoneNumber = "+60 19-456 7890",
                Email = "aisyah.abdullah@yahoo.com",
                ProductId = personalProduct?.Id ?? asbProduct.Id,
                StateId = stateKl.Id,
                BranchId = branchKl02?.Id,
                EmployerName = "Ministry of Health Malaysia",
                AppliedAmount = 50000m,
                HasPreferredSalesExecutive = false,
                Status = "New",
                CreatedAt = now.AddHours(-2),
                UpdatedAt = now.AddHours(-2),
            },
            new()
            {
                Id = Guid.NewGuid(),
                LeadReference = $"LEAD-{now:yyyyMMdd}-1004",
                CustomerName = "Kavitha a/p Subramaniam",
                IcNumber = "910304-07-5420",
                PhoneCountryCode = "+60",
                PhoneNumber = "+60 17-234 5678",
                Email = "kavitha.subra@outlook.com",
                ProductId = autoProduct?.Id ?? asbProduct.Id,
                StateId = statePenang?.Id ?? stateKl.Id,
                BranchId = branchPn01?.Id,
                EmployerName = "Intel Microelectronics",
                AppliedAmount = 95000m,
                HasPreferredSalesExecutive = true,
                PreferredSalesExecutiveId = execNoraini?.Id,
                Status = "Converted",
                CreatedAt = now.AddDays(-10),
                UpdatedAt = now.AddDays(-1),
            },
            new()
            {
                Id = Guid.NewGuid(),
                LeadReference = $"LEAD-{now:yyyyMMdd}-1005",
                CustomerName = "Ahmad Daniel bin Razali",
                IcNumber = "970912-14-5011",
                PhoneCountryCode = "+60",
                PhoneNumber = "+60 11-1234 5678",
                Email = "daniel.razali@maybank.com",
                ProductId = asbProduct.Id,
                StateId = stateKl.Id,
                BranchId = branchKl01?.Id,
                EmployerName = "Top Glove Corp",
                AppliedAmount = 200000m,
                HasPreferredSalesExecutive = false,
                Status = "In Progress",
                CreatedAt = now.AddDays(-6),
                UpdatedAt = now.AddDays(-1),
            },
            new()
            {
                Id = Guid.NewGuid(),
                LeadReference = $"LEAD-{now:yyyyMMdd}-1006",
                CustomerName = "Lee Sook Fern",
                IcNumber = "890528-14-6334",
                PhoneCountryCode = "+60",
                PhoneNumber = "+60 12-888 9922",
                Email = "sookfern.lee@gmail.com",
                ProductId = microProduct?.Id ?? asbProduct.Id,
                StateId = stateJohor?.Id ?? stateKl.Id,
                BranchId = branchKl01?.Id,
                EmployerName = "Kopitiam Enterprise",
                AppliedAmount = 35000m,
                HasPreferredSalesExecutive = true,
                PreferredSalesExecutiveId = execAzman?.Id,
                Status = "New",
                CreatedAt = now.AddHours(-5),
                UpdatedAt = now.AddHours(-5),
            },
            new()
            {
                Id = Guid.NewGuid(),
                LeadReference = $"LEAD-{now:yyyyMMdd}-1007",
                CustomerName = "Zulkifli bin Mansor",
                IcNumber = "850211-01-5233",
                PhoneCountryCode = "+60",
                PhoneNumber = "+60 13-999 4433",
                Email = "zulkifli.mansor@felda.gov.my",
                ProductId = homeProduct?.Id ?? asbProduct.Id,
                StateId = stateSel?.Id ?? stateKl.Id,
                BranchId = branchSl01?.Id,
                EmployerName = "Felda Global Ventures",
                AppliedAmount = 380000m,
                HasPreferredSalesExecutive = true,
                PreferredSalesExecutiveId = execKevin?.Id,
                Status = "Converted",
                CreatedAt = now.AddDays(-30),
                UpdatedAt = now.AddDays(-15),
            }
        };

        db.Leads.AddRange(sampleLeads);

        var auditLogs = sampleLeads.Select(l => new AuditLog
        {
            Id = Guid.NewGuid(),
            Timestamp = l.CreatedAt,
            UserId = "SYSTEM",
            UserName = "System Administrator",
            UserRole = "Admin",
            ActionType = "CREATE",
            EntityType = "LEAD",
            EntityId = l.Id.ToString(),
            Description = $"Created new lead application for customer '{l.CustomerName}'",
            Reason = "Lead registration submission",
            IpAddress = "127.0.0.1",
            Status = "SUCCESS",
        }).ToList();

        db.AuditLogs.AddRange(auditLogs);

        await db.SaveChangesAsync();
    }
}
