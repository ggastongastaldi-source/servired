import socketio
import time
import random

# Centro: Obelisco (-34.6037, -58.3816)
CENTER_LAT = -34.6037
CENTER_LNG = -58.3816
# Rango de dispersión (~20km para cubrir CABA y alrededores)
RANGE = 0.15 

sio = socketio.Client()

@sio.event
def connect():
    print("✅ Simulador conectado al servidor")

@sio.event
def disconnect():
    print("❌ Simulador desconectado")

def enviar_swarm():
    try:
        sio.connect('https://servired.online') # O tu URL de Railway
        workers = ["W1", "W2", "W3", "W4", "W5"]
        
        while True:
            for w_id in workers:
                # Generamos una coordenada aleatoria en BA
                lat = CENTER_LAT + (random.uniform(-RANGE, RANGE))
                lng = CENTER_LNG + (random.uniform(-RANGE, RANGE))
                
                payload = {
                    "worker_id": w_id,
                    "lat": lat,
                    "lng": lng,
                    "timestamp": time.time()
                }
                
                sio.emit('worker_gps_update', payload)
                print(f"📡 {w_id} enviado: {lat:.4f}, {lng:.4f}")
                time.sleep(0.5) # Ráfaga rápida para ver movimiento
            
            time.sleep(2)
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    enviar_swarm()
