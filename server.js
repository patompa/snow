const express = require('express')
const app = express()
const server = require('http').createServer(app)
const io = require('socket.io')(server)

app.use('/', express.static('public'))

io.on('connection', (socket) => {
  socket.on('join', (event) => {
    const selectedRoom = io.sockets.adapter.rooms[event.roomId]
    const numberOfClients = selectedRoom ? selectedRoom.length : 0

    // These events are emitted only to the sender socket.
    if (numberOfClients == 0) {
      console.log(`Creating room ${event.roomId} ${numberOfClients} and emitting room_created socket event`)
      socket.join(event.roomId)
      socket.emit('room_created', event.roomId)
    } else {
      console.log(`Joining room ${event.roomId} ${numberOfClients} and emitting room_joined socket event`)
      socket.join(event.roomId)
      socket.emit('room_joined', {roomId: event.roomId, clientId: numberOfClients})
    } 
  })

  // These events are emitted to all the sockets connected to the same room except the sender.
  socket.on('start_call', (event) => {
    console.log(`Broadcasting start_call event to peers in room ${event.roomId} ${event.to} ${event.from}`)
    socket.broadcast.to(event.roomId).emit('start_call', {to: event.to, from: event.from})
  })
  socket.on('webrtc_offer', (event) => {
    console.log(`Broadcasting webrtc_offer event to peers in room ${event.roomId} to ${event.to} from ${event.from}`)
    socket.broadcast.to(event.roomId).emit('webrtc_offer', event)
  })
  socket.on('webrtc_answer', (event) => {
    console.log(`Broadcasting webrtc_answer event to peers in room ${event.roomId} to ${event.to} from ${event.from}`)
    socket.broadcast.to(event.roomId).emit('webrtc_answer', event)
  })
  socket.on('webrtc_ice_candidate', (event) => {
    console.log(`Broadcasting webrtc_ice_candidate event to peers in room ${event.roomId} to ${event.to} from ${event.from}`)
    socket.broadcast.to(event.roomId).emit('webrtc_ice_candidate', event)
  })
  socket.on('hangup', (event) => {
    console.log(`Broadcasting hangup event to peers in room ${event.roomId} ${event.from}`)
    socket.broadcast.to(event.roomId).emit('hangup', {from: event.from})
  })
  socket.on('unsubscribe', (event) => {
    console.log(`Leaving room ${event.roomId} ${event.from}`)
    socket.leave(event.roomId);
  })
})

// START THE SERVER =================================================================
const port = process.env.PORT || 3000
server.listen(port, () => {
  console.log(`Express server listening on port ${port}`)
})
