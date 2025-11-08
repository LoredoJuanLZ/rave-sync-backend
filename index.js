// Importar las librerías necesarias
const http = require('http'); // Para crear un servidor HTTP básico
const WebSocketServer = require('ws').Server; // El servidor de WebSocket

// 1. CREAR EL SERVIDOR
// Creamos un servidor HTTP simple.
// Replit lo necesita para "despertar" el proyecto.
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Servidor de señalización P2P funcionando.');
});

// Adjuntamos el servidor de WebSocket al servidor HTTP
const wss = new WebSocketServer({ server });

// 2. LÓGICA DE SALAS
// Usaremos un 'Map' de JavaScript para almacenar las salas.
const rooms = new Map();

console.log('Servidor de WebSocket iniciado y esperando conexiones...');

// 3. MANEJAR NUEVAS CONEXIONES
wss.on('connection', (ws) => {
  console.log('Cliente conectado.');
  
  let currentRoomId = null;

  // 4. MANEJAR MENSAJES DEL CLIENTE
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);

      switch (data.type) {
        
        // --- CASO 1: Un usuario quiere CREAR una sala ---
        case 'create-room': {
          const newRoomId = generateRoomId(); // Genera un ID (ej: "A4B2")
          const clients = new Set(); // Crea un nuevo Set para los clientes
          clients.add(ws); // Añade al creador (Host) a la sala
          rooms.set(newRoomId, clients); // Guarda la sala en el 'Map'
          
          currentRoomId = newRoomId; // Guarda el ID en la conexión
          
          ws.send(JSON.stringify({
            type: 'room-created',
            roomId: newRoomId
          }));
          
          console.log(`Sala creada: ${newRoomId} por un cliente.`);
          break;
        }

        // --- CASO 2: Un usuario quiere UNIRSE a una sala ---
        case 'join-room': {
          const roomId = data.roomId.toUpperCase();
          const room = rooms.get(roomId); 

          if (!room) {
            ws.send(JSON.stringify({
              type: 'error',
              message: 'Sala no encontrada.'
            }));
            console.log(`Intento de unión fallido a sala inexistente: ${roomId}`);
            return;
          }

          // La sala existe, añadir al cliente
          room.add(ws);
          currentRoomId = roomId; 

          ws.send(JSON.stringify({
            type: 'room-joined',
            roomId: roomId
          }));
          
          // AVISA AL HOST que alguien se unió
          room.forEach(client => {
            if (client !== ws && client.readyState === client.OPEN) {
              client.send(JSON.stringify({ type: 'client-joined' }));
            }
          });

          console.log(`Cliente unido a la sala: ${roomId}`);
          break;
        }

        // --- CASO 3: Retransmitir un mensaje a la sala ---
        case 'relay-message': {
          const room = rooms.get(data.roomId);
          if (room) {
            // Envía el mensaje a TODOS los demás en la sala
            room.forEach(client => {
              if (client !== ws && client.readyState === client.OPEN) {
                client.send(message); 
              }
            });
          }
          break;
        }
      }
    } catch (e) {
      console.error('Error al procesar el mensaje:', e);
    }
  });

  // 5. MANEJAR DESCONEXIONES
  ws.on('close', () => {
    console.log('Cliente desconectado.');
    if (currentRoomId) {
      const room = rooms.get(currentRoomId);
      if (room) {
        room.delete(ws); 
        
        if (room.size === 0) {
          rooms.delete(currentRoomId);
          console.log(`Sala vacía y eliminada: ${currentRoomId}`);
        } else {
          // Avisa a los demás que alguien se fue
          room.forEach(client => {
            if (client.readyState === client.OPEN) {
              client.send(JSON.stringify({ type: 'client-left' }));
            }
          });
        }
      }
    }
  });

  // 6. MANEJAR ERRORES
  ws.on('error', (err) => {
    console.error('Error de WebSocket:', err);
  });
});

// Función simple para generar un ID de sala de 4 caracteres
function generateRoomId() {
  return Math.random().toString(36).substring(2, 6).toUpperCase();
}

// Inicia el servidor en el puerto que Replit le asigne
const port = process.env.PORT || 3000;
server.listen(port, () => {
  console.log(`Servidor HTTP escuchando en el puerto ${port}`);
});
