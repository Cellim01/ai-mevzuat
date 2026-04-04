using AiMevzuat.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace AiMevzuat.Infrastructure.Persistence.Configurations;

public class GazetteIssueConfiguration : IEntityTypeConfiguration<GazetteIssue>
{
    public void Configure(EntityTypeBuilder<GazetteIssue> b)
    {
        b.HasKey(x => x.Id);
        b.Property(x => x.IssueNumber).IsRequired();
        b.Property(x => x.PublishedDate).IsRequired();
        b.Property(x => x.MainPdfUrl).HasMaxLength(1024);
        b.Property(x => x.IndexUrl).HasMaxLength(1024);

        b.HasIndex(x => x.IssueNumber).IsUnique();
        b.HasIndex(x => x.PublishedDate);

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
        b.Property(x => x.Title).IsRequired().HasMaxLength(1000);
        b.Property(x => x.Summary).HasMaxLength(4000);
        b.Property(x => x.RawText).IsRequired();
        b.Property(x => x.SearchText).IsRequired();
        b.Property(x => x.HtmlUrl).HasMaxLength(1024);
        b.Property(x => x.PdfUrl).HasMaxLength(1024);
        b.Property(x => x.LocalFilePath).HasMaxLength(512);
        b.Property(x => x.MilvusVectorId).HasMaxLength(128);
        b.Property(x => x.RgSection).HasMaxLength(256);
        b.Property(x => x.RgSubSection).HasMaxLength(256);

        b.HasIndex(x => x.Category);
        b.HasIndex(x => x.GazetteIssueId);
        b.HasIndex(x => x.SourceType);
    }
}

public class UserConfiguration : IEntityTypeConfiguration<User>
{
    public void Configure(EntityTypeBuilder<User> b)
    {
        b.HasKey(x => x.Id);
        b.Property(x => x.Email).IsRequired().HasMaxLength(256);
        b.Property(x => x.PasswordHash).IsRequired().HasMaxLength(512);
        b.Property(x => x.FullName).IsRequired().HasMaxLength(200);
        b.HasIndex(x => x.Email).IsUnique();
    }
}

public class RefreshTokenConfiguration : IEntityTypeConfiguration<RefreshToken>
{
    public void Configure(EntityTypeBuilder<RefreshToken> b)
    {
        b.HasKey(x => x.Id);
        b.HasOne(x => x.User)
         .WithMany(x => x.RefreshTokens)
         .HasForeignKey(x => x.UserId)
         .OnDelete(DeleteBehavior.Cascade);
    }
}

public class DocumentChangeConfiguration : IEntityTypeConfiguration<DocumentChange>
{
    public void Configure(EntityTypeBuilder<DocumentChange> b)
    {
        b.HasKey(x => x.Id);
        b.Property(x => x.AiExplanation).HasMaxLength(4000);
        b.HasOne(x => x.Document)
         .WithMany(x => x.Changes)
         .HasForeignKey(x => x.DocumentId)
         .OnDelete(DeleteBehavior.Cascade);
    }
}

public class UserSubscriptionConfiguration : IEntityTypeConfiguration<UserSubscription>
{
    public void Configure(EntityTypeBuilder<UserSubscription> b)
    {
        b.HasKey(x => x.Id);
        b.HasOne(x => x.User)
         .WithMany(x => x.Subscriptions)
         .HasForeignKey(x => x.UserId)
         .OnDelete(DeleteBehavior.Cascade);
    }
}

public class UserKeywordConfiguration : IEntityTypeConfiguration<UserKeyword>
{
    public void Configure(EntityTypeBuilder<UserKeyword> b)
    {
        b.HasKey(x => x.Id);
        b.Property(x => x.Keyword).IsRequired().HasMaxLength(256);
        b.HasOne(x => x.User)
         .WithMany(x => x.Keywords)
         .HasForeignKey(x => x.UserId)
         .OnDelete(DeleteBehavior.Cascade);
    }
}

public class ExternalLawCacheConfiguration : IEntityTypeConfiguration<ExternalLawCache>
{
    public void Configure(EntityTypeBuilder<ExternalLawCache> b)
    {
        b.HasKey(x => x.Id);

        b.Property(x => x.Source).IsRequired().HasMaxLength(64);
        b.Property(x => x.QueryHash).IsRequired().HasMaxLength(128);
        b.Property(x => x.QueryText).IsRequired().HasMaxLength(2000);
        b.Property(x => x.ExternalId).IsRequired().HasMaxLength(256);
        b.Property(x => x.Title).IsRequired().HasMaxLength(1000);
        b.Property(x => x.Content).IsRequired();
        b.Property(x => x.SourceUrl).HasMaxLength(1024);

        b.HasIndex(x => new { x.Source, x.QueryHash }).IsUnique();
        b.HasIndex(x => x.ExpiresAt);
    }
}
