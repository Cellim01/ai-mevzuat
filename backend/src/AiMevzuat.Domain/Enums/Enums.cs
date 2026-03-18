namespace AiMevzuat.Domain.Enums;

public enum UserRole
{
    Free         = 0,
    Professional = 1,
    Enterprise   = 2,
    Admin        = 99
}

public enum DocumentCategory
{
    Diger            = 0,
    Yonetmelik       = 1,
    Teblig           = 2,
    Kanun            = 3,
    Cumhurbaskanligi = 4,
    Bankacilik       = 5,
    SermayePiyasasi  = 6,
    FinansVergi      = 7,
    DisTicaret       = 8,
    AkademikIlan     = 9,
    InsanKaynaklari  = 10,
    Saglik           = 11,
    CevreEnerji      = 12,
    IhaleIlan        = 13,
    YargiKarari      = 14,
    YargiIlan        = 15,
    CesitliIlan      = 16
}

public enum ProcessStatus
{
    Pending    = 0,
    Processing = 1,
    Completed  = 2,
    Failed     = 3
}

public enum SourceType
{
    Html = 0,
    Pdf  = 1
}
