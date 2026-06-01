.PHONY: r-backend service frontend dev kill-ports

kill-ports:
	-lsof -ti :5555 | xargs kill -9 2>/dev/null
	-lsof -ti :3001 | xargs kill -9 2>/dev/null

r-backend:
	-lsof -ti :5555 | xargs kill -9 2>/dev/null
	./backend/start_r_backend.sh

service:
	-lsof -ti :3001 | xargs kill -9 2>/dev/null
	cd backend/service && npm start

frontend:
	cd vite-project && npm run dev

dev: kill-ports
	./backend/start_r_backend.sh & cd backend/service && npm start & cd vite-project && npm run dev
