import { GraphQLError } from 'graphql';
import { ChatSession } from '../../models/index.js';
import { generateChatReply } from '../../services/chatService.js';
import { requireAuth } from '../../middleware/auth.js';
import { logActivity } from '../../services/activityService.js';
import { assertWorkspace } from '../../utils/access.js';

export const chatResolvers = {
  Query: {
    chatSession: async (_, { sessionId }, context) => {
      await assertWorkspace(context);
      return ChatSession.findOne({ sessionId, orgId: context.orgId });
    },
  },

  Mutation: {
    sendChatMessage: async (_, { sessionId, message, activeCompanyId }, context) => {
      await assertWorkspace(context);

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

      // Call AI Chat Service with conversational history, active company context, and live org financials
      const replyContent = await generateChatReply(
        context.orgId,
        context.userId,
        sessionId,
        message.trim(),
        session.messages,
        activeCompanyId
      );

      const assistantMsg = {
        role: 'assistant',
        content: replyContent,
        timestamp: new Date(),
      };
      session.messages.push(assistantMsg);

      await session.save();

      logActivity({
        orgId: context.orgId,
        userId: context.userId,
        action: 'AI_CHAT_MESSAGE',
        entityType: 'ChatSession',
        description: `Queried Vault AI Assistant: "${message.trim().substring(0, 40)}${message.trim().length > 40 ? '...' : ''}"`,
        metadata: { sessionId },
      });

      return {
        role: assistantMsg.role,
        content: assistantMsg.content,
        timestamp: assistantMsg.timestamp.toISOString(),
      };
    },

    clearChatSession: async (_, { sessionId }, context) => {
      await assertWorkspace(context);
      const result = await ChatSession.findOneAndDelete({ sessionId, orgId: context.orgId });
      return !!result;
    },
  },
};

export default chatResolvers;
