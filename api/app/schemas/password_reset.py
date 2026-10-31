from pydantic import BaseModel, EmailStr, Field, field_validator

def _normalize_email(value: str) -> str:
    return value.strip().lower()


class ForgotPasswordRequest(BaseModel):
    email: str = Field(min_length=3, max_length=255)

    _normalize = field_validator("email")(_normalize_email)


class VerifyResetCodeRequest(BaseModel):
    email: EmailStr
    code: str = Field(pattern=r"^\d{5}$")      # 5 chiffres, comme CODE_LENGTH du service


class ResetTokenResponse(BaseModel):
    token: str


class ResetPasswordRequest(BaseModel):
    token: str = Field(min_length=20, max_length=2000)
    new_password: str = Field(min_length=8, max_length=128)