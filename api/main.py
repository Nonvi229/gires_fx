from fastapi import FastAPI

app = FastAPI()

@app.get("/api/say_hello/")
def say_hello():
    return {
        "status": "hello world"
    }