from typing import Annotated
from pydantic import BaseModel, EmailStr, Field, StringConstraints, field_validator
import uuid

# Les espaces sont retirés AVANT le contrôle de longueur (« A  » est refusé)
PersonName = Annotated[str, StringConstraints(strip_whitespace=True, min_length=2, max_length=100)]

class LoginIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)


class TokenOut(BaseModel):
    token: str


class MeOut(BaseModel):
    id: uuid.UUID
    email: EmailStr
    name: str
    surname: str
    
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

class UpdateProfileIn(BaseModel):
    name: PersonName
    surname: PersonName


class ChangePasswordIn(BaseModel):
    current_password: str = Field(min_length=1, max_length=128)
    new_password: str = Field(min_length=8, max_length=128)  # mêmes règles que RegisterIn