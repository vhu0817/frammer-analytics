from pydantic import BaseModel, EmailStr, Field


# request schemas

class RegisterRequest(BaseModel):
    email: EmailStr
    username: str = Field(min_length=2, max_length=100)
    password: str = Field(min_length=6, max_length=128)
    client_id: int
    team_name: str = Field(min_length=1, max_length=100)
    role: str = Field(default="user", pattern=r"^(website_admin|client_admin|user)$")


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


# response schemas

class UserResponse(BaseModel):
    user_id: int
    email: str
    username: str
    client_id: int
    team_name: str
    role: str

    # lets pydantic read data straight from sqlalchemy model instances
    model_config = {"from_attributes": True}


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse
