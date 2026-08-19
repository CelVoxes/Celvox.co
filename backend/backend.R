library(plumber)

options(plumber.debug = TRUE)

# Bind address/port are configurable so the same entrypoint works on a laptop
# (loopback, the historical default) and inside a container (0.0.0.0).
host <- Sys.getenv("R_BACKEND_HOST", unset = "127.0.0.1")
port <- as.integer(Sys.getenv("R_BACKEND_PORT", unset = "5555"))

# Plumb the API
r <- plumb("plumber.R") # Ensure the path is correct
r$run(host = host, port = port)
