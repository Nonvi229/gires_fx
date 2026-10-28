from pydantic import BaseModel, EmailStr, Field, field_validator


class RegisterIn(BaseModel):
    name: str = Field(min_length=2, max_length=100)
    surname: str = Field(min_length=2, max_length=100)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)

    @field_validator("name", "surname")
    @classmethod
    def clean(cls, v: str) -> str:
        return v.strip()


class VerifyEmailIn(BaseModel):
    email: EmailStr
    code: str = Field(pattern=r"^\d{5}$")


class MessageOut(BaseModel):
    message: str

class ResendIn(BaseModel):
    email: EmailStr