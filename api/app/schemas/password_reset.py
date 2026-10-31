from pydantic import BaseModel, Field, field_validator


def _normalize_email(value: str) -> str:
    return value.strip().lower()


class ForgotPasswordRequest(BaseModel):
    email: str = Field(min_length=3, max_length=255)

    _normalize = field_validator("email")(_normalize_email)


class ResetPasswordRequest(BaseModel):
    email: str = Field(min_length=3, max_length=255)
    code: str = Field(pattern=r"^\d{6}$")
    new_password: str = Field(min_length=8, max_length=128)

    _normalize = field_validator("email")(_normalize_email)