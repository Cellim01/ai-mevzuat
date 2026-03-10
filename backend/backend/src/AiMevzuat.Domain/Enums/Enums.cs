namespace AiMevzuat.Domain.Enums;

public enum UserRole
{
    Free = 0,
    Professional = 1,
    Enterprise = 2,
    Admin = 99
}

public enum DocumentCategory
{
    Diger = 0,
    InsanKaynaklari = 1,
    FinansVergi = 2,
    DisTicaret = 3,
    SermayePiyasasi = 4,
    AkademikIlan = 5,
    CevreEnerji = 6,
    Saglik = 7,
    IhaleIlan = 8,
    YargiCeza = 9,
    Cumhurbaskanligi = 10,
    Bankacilik = 11
}

public enum ProcessStatus
{
    Pending = 0,
    Processing = 1,
    Completed = 2,
    Failed = 3
}
