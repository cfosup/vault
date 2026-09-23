import { GraphQLError } from 'graphql';
import { ChatSession } from '../../models/index.js';
import { generateChatReply } from '../../services/chatService.js';
import { requireAuth } from '../../middleware/auth.js';

export const chatResolvers = {
  Query: {
    chatSession: async (_, { sessionId }, context) => {
      requireAuth(context);
      return ChatSession.findOne({ sessionId, orgId: context.orgId });
    },
  },

  Mutation: {
    sendChatMessage: async (_, { sessionId, message }, context) => {
      requireAuth(context);

      if (!sessionId || !message || !message.trim()) {
        throw new GraphQLError('Session ID and message are required', {
          extensions: { code: 'BAD_USER_INPUT' },
        });
      }

      let session = await ChatSession.findOne({ sessionId, orgId: context.orgId });
      if (!session) {
        session = await ChatSession.create({
          orgId: context.orgId,
          userId: context.userId,
          sessionId,
          messages: [],
        });
      }

      const userMsg = {
        role: 'user',
        content: message.trim(),
        timestamp: new Date(),
      };
      session.messages.push(userMsg);

      // Call AI Chat Service with conversational history and live org financial context
      const replyContent = await generateChatReply(
        context.orgId,
        context.userId,
        sessionId,
        message.trim(),
        session.messages
      );

      const assistantMsg = {
        role: 'assistant',
        content: replyContent,
        timestamp: new Date(),
      };
      session.messages.push(assistantMsg);

      await session.save();

      return {
        role: assistantMsg.role,
        content: assistantMsg.content,
        timestamp: assistantMsg.timestamp.toISOString(),
      };
    },

    clearChatSession: async (_, { sessionId }, context) => {
      requireAuth(context);
      const result = await ChatSession.findOneAndDelete({ sessionId, orgId: context.orgId });
      return !!result;
    },
  },
};

export default chatResolvers;
