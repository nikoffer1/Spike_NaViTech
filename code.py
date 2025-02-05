from pybricks.pupdevices import ForceSensor
from pybricks.parameters import Port
from pybricks.tools import wait

# Initialize the force sensor on Port A.
force_sensor = ForceSensor(Port.A)

while True:
    # Read sensor values.
    force = force_sensor.force()
    distance = force_sensor.distance()
    press = force_sensor.pressed()
    touch = force_sensor.touched()

    # Compose a CSV-formatted message.
    message = "{:.2f},{:.2f},{},{}".format(force, distance, press, touch)

    # Print the message. This will send it via NUS.
    print(message)  # Use print() to send data over NUS (actually Command/Event Char!)

    # Wait 200ms before taking the next measurement.
    wait(200)