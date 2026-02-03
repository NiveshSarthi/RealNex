const amqp = require('amqplib');
require('dotenv').config();

let connection = null;
let channel = null;

// Connect to RabbitMQ
const connectRabbitMQ = async () => {
  try {
    connection = await amqp.connect(process.env.RABBITMQ_URL);
    channel = await connection.createChannel();

    console.log('Connected to RabbitMQ');

    // Handle connection close
    connection.on('close', () => {
      console.log('RabbitMQ connection closed');
      setTimeout(connectRabbitMQ, 5000); // Reconnect after 5 seconds
    });

    connection.on('error', (err) => {
      console.error('RabbitMQ connection error:', err);
    });

    return { connection, channel };
  } catch (error) {
    console.error('Failed to connect to RabbitMQ:', error);
    setTimeout(connectRabbitMQ, 5000);
    return null;
  }
};

// Send message to queue
const sendToQueue = async (queue, message) => {
  try {
    if (!channel) {
      await connectRabbitMQ();
    }

    await channel.assertQueue(queue, { durable: true });
    channel.sendToQueue(queue, Buffer.from(JSON.stringify(message)), {
      persistent: true,
    });

    console.log(`Message sent to queue ${queue}:`, message);
  } catch (error) {
    console.error('Error sending message to queue:', error);
  }
};

// Consume messages from queue
const consumeFromQueue = async (queue, callback) => {
  try {
    if (!channel) {
      await connectRabbitMQ();
    }

    await channel.assertQueue(queue, { durable: true });
    channel.prefetch(1); // Process one message at a time

    console.log(`Waiting for messages in queue: ${queue}`);

    channel.consume(queue, async (msg) => {
      if (msg) {
        try {
          const message = JSON.parse(msg.content.toString());
          await callback(message);
          channel.ack(msg);
        } catch (error) {
          console.error('Error processing message:', error);
          channel.nack(msg, false, false); // Don't requeue
        }
      }
    });
  } catch (error) {
    console.error('Error consuming from queue:', error);
  }
};

// Publish to exchange
const publishToExchange = async (exchange, routingKey, message) => {
  try {
    if (!channel) {
      await connectRabbitMQ();
    }

    await channel.assertExchange(exchange, 'topic', { durable: true });
    channel.publish(exchange, routingKey, Buffer.from(JSON.stringify(message)));

    console.log(`Message published to exchange ${exchange} with routing key ${routingKey}:`, message);
  } catch (error) {
    console.error('Error publishing to exchange:', error);
  }
};

// Subscribe to exchange
const subscribeToExchange = async (exchange, routingKey, callback) => {
  try {
    if (!channel) {
      await connectRabbitMQ();
    }

    const q = await channel.assertQueue('', { exclusive: true });
    await channel.assertExchange(exchange, 'topic', { durable: true });
    channel.bindQueue(q.queue, exchange, routingKey);

    console.log(`Subscribed to exchange ${exchange} with routing key ${routingKey}`);

    channel.consume(q.queue, async (msg) => {
      if (msg) {
        try {
          const message = JSON.parse(msg.content.toString());
          await callback(message);
          channel.ack(msg);
        } catch (error) {
          console.error('Error processing message:', error);
          channel.nack(msg, false, false);
        }
      }
    });
  } catch (error) {
    console.error('Error subscribing to exchange:', error);
  }
};

// Graceful shutdown
const closeConnection = async () => {
  try {
    if (channel) {
      await channel.close();
    }
    if (connection) {
      await connection.close();
    }
    console.log('RabbitMQ connection closed');
  } catch (error) {
    console.error('Error closing RabbitMQ connection:', error);
  }
};

module.exports = {
  connectRabbitMQ,
  sendToQueue,
  consumeFromQueue,
  publishToExchange,
  subscribeToExchange,
  closeConnection,
};