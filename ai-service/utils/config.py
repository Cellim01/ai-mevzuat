from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # API
    app_name: str = "AI-Mevzuat Service"
    debug: bool = False

    # Frontend CORS origins (comma-separated)
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173,http://localhost:3000,http://127.0.0.1:3000"

    # .NET backend
    backend_url: str = "http://localhost:5000"
    backend_api_key: str = ""

    # Resmi Gazete
    gazette_base_url: str = "https://www.resmigazete.gov.tr"
    gazette_download_dir: str = "./downloads"

    # MSSQL (AI service read connection)
    db_connection: str = ""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )


settings = Settings()
