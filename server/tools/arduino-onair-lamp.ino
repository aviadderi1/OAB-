// OAB studio light for Arduino (Uno / Nano / Pro Micro ...)
// In OAB: Settings -> Studio light (USB) -> "Arduino / serial board", Connect...
// The studio sends "1" when a microphone is on and "0" when both are off.
// Pin 13 = the built-in LED. Connect a relay module or a LED (with a resistor) to LAMP_PIN.
const int LAMP_PIN = 13;
void setup() { pinMode(LAMP_PIN, OUTPUT); digitalWrite(LAMP_PIN, LOW); Serial.begin(9600); }
void loop() {
  while (Serial.available()) {
    char c = Serial.read();
    if (c == '1') digitalWrite(LAMP_PIN, HIGH);
    if (c == '0') digitalWrite(LAMP_PIN, LOW);
  }
}
