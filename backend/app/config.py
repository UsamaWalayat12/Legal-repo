from pydantic_settings import BaseSettings
from dotenv import load_dotenv

load_dotenv()


class Settings(BaseSettings):
    google_api_key: str = ""
    embedding_model: str = "text-embedding-004"
    chat_model: str = "gemini-2.0-flash"
    chroma_persist_dir: str = "./backend/data/chroma"
    chunk_size: int = 800
    chunk_overlap: int = 150
    top_k: int = 6
    supabase_url: str = ""
    supabase_service_role_key: str = ""
    # Supabase JWT secret — used to verify tokens issued by Supabase Auth
    # Dashboard → Project Settings → API → JWT Secret
    supabase_jwt_secret: str = ""

    class Config:
        env_file = ".env"


settings = Settings()
