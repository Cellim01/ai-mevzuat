from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # API
    app_name: str = "AI-Mevzuat Service"
    debug: bool = False

    # .NET backend
    backend_url: str = "http://localhost:5000"
    backend_api_key: str = ""

    # Resmi Gazete
    gazette_base_url: str = "https://www.resmigazete.gov.tr"
    gazette_download_dir: str = "./downloads"

    # MSSQL (AI servisinin kendi okuma bağlantısı)
    db_connection: str = ""

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


settings = Settings()
