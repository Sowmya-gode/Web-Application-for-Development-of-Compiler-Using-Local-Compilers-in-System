# Write your code here
# This is a comment. Comments start with a '#' and are ignored by the interpreter.

# Printing a message to the console
print("Hello, Python!")

# Storing a value in a variable
name = "Alice"
age = 30

# Using f-strings for formatted output (available in Python 3.6+)
print(f"My name is {name} and I am {age} years old.")

# Performing a simple arithmetic operation
num1 = 10
num2 = 5
sum_result = num1 + num2
print(f"The sum of {num1} and {num2} is {sum_result}.")

# Conditional statement (if-else)
if age >= 18:
    print("You are an adult.")
else:
    print("You are a minor.")

# Looping through a sequence (for loop)
for i in range(3): # range(3) generates numbers 0, 1, 2
    print(f"Loop iteration: {i}")

# Defining a simple function
def greet(person_name):
    return f"Hello, {person_name}!"

# Calling the function and printing its return value
greeting_message = greet("Bob")
print(greeting_message)