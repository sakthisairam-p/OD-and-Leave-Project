import asyncio
import aiohttp

async def fetch(session, url, token):
    async with session.get(url, headers={"Authorization": f"Bearer {token}"}) as resp:
        return resp.status, await resp.text()

async def main():
    async with aiohttp.ClientSession() as session:
        # Login
        async with session.post("http://localhost:8000/api/v1/auth/login", json={
            "login_id": "student.aiml@kitech.edu.in",
            "password": "student@aiml",
            "target_role": "STUDENT"
        }) as login_resp:
            login_data = await login_resp.json()
            token = login_data["access_token"]
            
        print("Got token")
        
        # Parallel fetch
        urls = [
            "http://localhost:8000/api/v1/auth/me",
            "http://localhost:8000/api/v1/leave/my",
            "http://localhost:8000/api/v1/od/my"
        ]
        
        tasks = [fetch(session, u, token) for u in urls]
        results = await asyncio.gather(*tasks)
        
        for url, res in zip(urls, results):
            print(f"{url} -> {res[0]}")
            if res[0] != 200:
                print(res[1])

if __name__ == "__main__":
    asyncio.run(main())
