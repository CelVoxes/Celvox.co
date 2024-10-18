library(plumber)

options(plumber.debug = TRUE)

# Plumb the API
r <- plumb("plumber.R") # Ensure the path is correct
r$run(port = 5555)
