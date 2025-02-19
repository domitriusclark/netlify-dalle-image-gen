import { useState, useRef, useEffect } from "react";

interface Message {
  role: "user" | "assistant";
  content: string;
  imageUrl?: string;
}

export default function Chat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  function scrollToBottom() {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  function addMessage(message: Message) {
    setMessages(prev => [...prev, message]);
  }

  function updateLastMessage(content: string) {
    setMessages(prev => [
      ...prev.slice(0, -1),
      { role: "assistant", content }
    ]);
  }

  async function processStreamResponse(reader: ReadableStreamDefaultReader<Uint8Array>) {
    let assistantMessage = "";
    addMessage({ role: "assistant", content: "" });

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const text = new TextDecoder().decode(value);
      assistantMessage += text;
      updateLastMessage(assistantMessage);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage = { role: "user" as const, content: input.trim() };
    addMessage(userMessage);
    setInput("");
    setIsLoading(true);

    try {
      const isImageRequest = userMessage.content.toLowerCase().match(/(generate|create|draw|make).*(image|picture|artwork|drawing)/i);

      if (isImageRequest) {
        const imageResponse = await fetch("/dalle", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: userMessage.content }),
        });

        if (!imageResponse.ok) throw new Error("Image generation failed");

        const imageUrl = await imageResponse.json();
        addMessage({ 
          role: "assistant", 
          content: "Here's your generated image:", 
          imageUrl 
        });
      } else {
        const chatResponse = await fetch("/dalle", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: userMessage.content }),
        });

        if (!chatResponse.ok) throw new Error("Chat response was not ok");

        const reader = chatResponse.body?.getReader();
        if (!reader) throw new Error("No reader available");

        await processStreamResponse(reader);
      }
    } catch (error) {
      console.error("Error:", error);
      addMessage({
        role: "assistant",
        content: "Sorry, there was an error processing your request.",
      });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="flex flex-col h-[600px] border border-gray-200 rounded-lg bg-white">
      <div className="flex-1 overflow-y-auto p-4">
        {messages.map((message, index) => (
          <div
            key={index}
            className={`mb-4 p-3 rounded-lg max-w-[80%] ${
              message.role === "user"
                ? "ml-auto bg-blue-600 text-white"
                : "mr-auto bg-gray-100 text-gray-800"
            }`}>
            <strong>{message.role === "user" ? "You: " : "AI: "}</strong>
            <span>{message.content}</span>
            {message.imageUrl && (
              <div className="mt-2">
                <img 
                  src={message.imageUrl} 
                  alt="Generated image"
                  className="rounded-lg max-w-full h-auto" 
                />
              </div>
            )}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>
      <form onSubmit={handleSubmit} className="flex p-4 border-t border-gray-200 gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type your message..."
          className="flex-1 p-2 border border-gray-200 rounded text-base disabled:bg-gray-50 disabled:cursor-not-allowed"
          disabled={isLoading}
        />
        <button
          type="submit"
          disabled={isLoading}
          className="px-4 py-2 bg-blue-600 text-white rounded cursor-pointer text-base disabled:bg-blue-400 disabled:cursor-not-allowed">
          {isLoading ? "Sending..." : "Send"}
        </button>
      </form>
    </div>
  );
}