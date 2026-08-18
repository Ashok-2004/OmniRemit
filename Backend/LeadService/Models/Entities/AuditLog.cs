using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace LeadManagement.Api.Models.Entities
{
    [Table("AuditLogs")]
    public class AuditLog
    {
        [Key]
        public Guid Id { get; set; } = Guid.NewGuid();

        [Required]
        public DateTime Timestamp { get; set; } = DateTime.UtcNow;

        [Required]
        [MaxLength(100)]
        public string UserId { get; set; } = "USR-1001";

        [Required]
        [MaxLength(150)]
        public string UserName { get; set; } = "Admin User";

        [Required]
        [MaxLength(50)]
        public string UserRole { get; set; } = "Administrator";

        [Required]
        [MaxLength(50)]
        public string ActionType { get; set; } = string.Empty; // Create, Edit, Delete, View

        [Required]
        [MaxLength(50)]
        public string EntityType { get; set; } = "Lead";

        [Required]
        [MaxLength(100)]
        public string EntityId { get; set; } = string.Empty;

        [MaxLength(500)]
        public string Description { get; set; } = string.Empty;

        public string? Reason { get; set; }

        public string? PreviousValues { get; set; } // JSON format

        public string? NewValues { get; set; } // JSON format

        [MaxLength(50)]
        public string IpAddress { get; set; } = "127.0.0.1";

        [MaxLength(20)]
        public string Status { get; set; } = "Success";
    }
}
