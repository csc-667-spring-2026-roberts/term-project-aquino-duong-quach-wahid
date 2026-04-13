// connect to SSE
const eventSource = new EventSource("/api/sse");

// handle incoming events
eventSource.onmessage = (event) => {
  console.log(event.data);
};

// handle errors
eventSource.onerror = (error) => {
  console.error(error);
};
