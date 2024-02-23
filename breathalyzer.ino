#include <SPI.h>
#include <WiFiNINA.h>

char ssid[] = "q42iot";
char pass[] = "TODO";
int keyIndex = 0;

const int ALCOHOL_PIN = A0;

const int SUCCESS_PIN = 2;
const int FAILURE_PIN = 4;

unsigned long lastSendTime = 0;
unsigned long sendDebounceDelay = 5000;  // ms

int status = WL_IDLE_STATUS;
char server[] = "breathalyzer-cf72ee67e743.herokuapp.com";
WiFiClient client;

void setup() {
  pinMode(ALCOHOL_PIN, INPUT);
  pinMode(SUCCESS_PIN, INPUT);
  pinMode(FAILURE_PIN, INPUT);

  Serial.begin(9600);
  while (!Serial) {
    ;
  }

  if (WiFi.status() == WL_NO_MODULE) {
    Serial.println("Communication with WiFi module failed!");
    while (true) {
      ;
    }
  }

  String fv = WiFi.firmwareVersion();
  if (fv < WIFI_FIRMWARE_LATEST_VERSION) {
    Serial.println("Please upgrade the firmware");
  }

  // attempt to connect to WiFi network:
  while (status != WL_CONNECTED) {
    Serial.print("Attempting to connect to SSID: ");
    Serial.println(ssid);
    status = WiFi.begin(ssid, pass);

    delay(10000);
  }
  Serial.println("Connected to WiFi");
  printWifiStatus();

  Serial.println("\nStarting connection to server...");
  if (client.connect(server, 80)) {
    Serial.println("connected to server");
  }
}

void loop() {
  Serial.println("_upper:1024");
  Serial.println("_lower:0");
  Serial.print("ALCOHOL:");
  Serial.println(analogRead(ALCOHOL_PIN), DEC);

  if (digitalRead(SUCCESS_PIN) == HIGH) {
    Serial.println("Sending success");
    sendConclusion(true, 100);
  }

  if (digitalRead(FAILURE_PIN) == HIGH) {
    Serial.println("Sending failure");
    sendConclusion(false, 200);
  }

  if (!client.connected()) {
    Serial.println();
    Serial.println("disconnecting from server.");
    client.stop();

    while (true) {
      ;
    }
  }
}


void sendConclusion(bool success, int value) {
  if ((millis() - lastSendTime) < sendDebounceDelay) {
    return;
  }
  Serial.println("sending request...");

  const String successString = success ? "true" : "false";
  if (client.connect(server, 80)) {
    lastSendTime = millis();

    client.println("POST /post?success=" + successString + "&value=" + String(value) + " HTTP/1.1");
    client.println("Host: " + String(server));
    client.println("Connection: close");
    client.println();
  }
}

void printWifiStatus() {
  Serial.print("SSID: ");
  Serial.println(WiFi.SSID());

  IPAddress ip = WiFi.localIP();
  Serial.print("IP Address: ");
  Serial.println(ip);

  long rssi = WiFi.RSSI();
  Serial.print("signal strength (RSSI):");
  Serial.print(rssi);
  Serial.println(" dBm");
}