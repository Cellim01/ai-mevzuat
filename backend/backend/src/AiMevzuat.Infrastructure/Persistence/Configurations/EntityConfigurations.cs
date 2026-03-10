using AiMevzuat.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace AiMevzuat.Infrastructure.Persistence.Configurations;

public class UserConfiguration : IEntityTypeConfiguration<User>
{
    public void Configure(EntityTypeBuilder<User> b)
    {
        b.HasKey(x => x.Id);
        b.Property(x => x.Email).HasMaxLength(256).IsRequired();
        b.HasIndex(x => x.Email).IsUnique();
        b.Property(x => x.FullName).HasMaxLength(200).IsRequired();
        b.Property(x => x.PasswordHash).HasMaxLength(512).IsRequired();

        b.HasMany(x => x.RefreshTokens)
            .WithOne(x => x.User)
            .HasForeignKey(x => x.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        b.HasMany(x => x.Subscriptions)
            .WithOne(x => x.User)
            .HasForeignKey(x => x.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        b.HasMany(x => x.Keywords)
            .WithOne(x => x.User)
            .HasForeignKey(x => x.UserId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}

public class GazetteIssueConfiguration : IEntityTypeConfiguration<GazetteIssue>
{
    public void Configure(EntityTypeBuilder<GazetteIssue> b)
    {
        b.HasKey(x => x.Id);
        b.HasIndex(x => x.IssueNumber).IsUnique();
        b.HasIndex(x => x.PublishedDate);
        b.Property(x => x.PdfUrl).HasMaxLength(1024);
        b.Property(x => x.LocalPdfPath).HasMaxLength(512);

        b.HasMany(x => x.Documents)
            .WithOne(x => x.Issue)
            .HasForeignKey(x => x.GazetteIssueId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}

public class GazetteDocumentConfiguration : IEntityTypeConfiguration<GazetteDocument>
{
    public void Configure(EntityTypeBuilder<GazetteDocument> b)
    {
        b.HasKey(x => x.Id);
        b.Property(x => x.Title).HasMaxLength(1000).IsRequired();
        b.Property(x => x.Summary).HasMaxLength(4000);
        b.Property(x => x.RawText).HasColumnType("nvarchar(max)");
        b.Property(x => x.MilvusVectorId).HasMaxLength(128);
        b.HasIndex(x => x.Category);
        b.HasIndex(x => x.GazetteIssueId);
    }
}

public class DocumentChangeConfiguration : IEntityTypeConfiguration<DocumentChange>
{
    public void Configure(EntityTypeBuilder<DocumentChange> b)
    {
        b.HasKey(x => x.Id);
        b.Property(x => x.OldText).HasColumnType("nvarchar(max)");
        b.Property(x => x.NewText).HasColumnType("nvarchar(max)");
        b.Property(x => x.AiExplanation).HasMaxLength(4000);
        b.Property(x => x.DiffJson).HasColumnType("nvarchar(max)");
    }
}
