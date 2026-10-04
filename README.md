# TrustGuard

TrustGuard checks suspicious SMS, WhatsApp and email text, explains the warning signs, and suggests safer next steps. Its local-first detector combines transparent rules with an optional Ollama open-weight model; messages are never saved by the API.

## Run

1. Install Python 3.11 and Node.js 20+.
2. Install dependencies: `py -m pip install -r requirements.txt` and `npm --prefix web install`.
3. Run in two terminals: `py -m uvicorn api.main:app --reload --port 8000` and `npm --prefix web run dev`.
4. Optional AI: install Ollama and run `ollama pull qwen2.5:7b`; the rule engine works when Ollama is offline.

Open the Vite URL; API docs are at `http://localhost:8000/docs`.

## Credits and licences

- Qwen2.5 7B by Alibaba Cloud, Apache-2.0, served locally through Ollama. Optional; see the [model card](https://huggingface.co/Qwen/Qwen2.5-7B-Instruct).
- FastAPI (MIT), Uvicorn (BSD-3-Clause), Pydantic (MIT), React (MIT), Vite (MIT), TypeScript (Apache-2.0), Lucide React (ISC), and Recharts (MIT).
- TrustGuard source code: MIT. No third-party dataset is downloaded or bundled.

## 60-second demo

Paste the fake KYC sample and show the urgent credential request and shortened link highlights. Then check the bank OTP sample to demonstrate a low-risk legitimate message. Finish with the vague recruitment message to discuss why a message without enough evidence is marked uncertain. Mention that demo inputs stay in this browser session and the local API does not persist them.
