import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import { messageAPI } from '../services/api';
import { Mail, MailOpen, Trash2, Reply, X, Send } from 'lucide-react';

const Inbox = () => {
  const navigate = useNavigate();
  const [messages, setMessages] = useState([]);
  const [selectedMessage, setSelectedMessage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [showReplyModal, setShowReplyModal] = useState(false);
  const [replyData, setReplyData] = useState({ subject: '', content: '' });
  const [sending, setSending] = useState(false);

  useEffect(() => {
    fetchMessages();
  }, [filter]);

  const fetchMessages = async () => {
    try {
      const params = filter === 'unread' ? { unreadOnly: true } : {};
      const response = await messageAPI.getInbox(params);
      setMessages(response.data);
    } catch (error) {
      console.error('Failed to fetch messages:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleViewMessage = async (message) => {
    try {
      const response = await messageAPI.getById(message.id);
      setSelectedMessage(response.data);
      
      // Update local state
      setMessages(messages.map(m => 
        m.id === message.id ? { ...m, is_read: true } : m
      ));
    } catch (error) {
      console.error('Failed to fetch message:', error);
    }
  };

  const handleDeleteMessage = async (messageId) => {
    if (!confirm('Are you sure you want to delete this message?')) return;

    try {
      await messageAPI.delete(messageId);
      setMessages(messages.filter(m => m.id !== messageId));
      if (selectedMessage?.id === messageId) {
        setSelectedMessage(null);
      }
    } catch (error) {
      alert('Failed to delete message');
    }
  };

  const handleReply = () => {
    if (selectedMessage) {
      setReplyData({
        subject: `Re: ${selectedMessage.subject}`,
        content: ''
      });
      setShowReplyModal(true);
    }
  };

  const handleSendReply = async (e) => {
    e.preventDefault();
    if (!replyData.subject || !replyData.content) {
      alert('Please fill in all fields');
      return;
    }

    setSending(true);
    try {
      await messageAPI.send({
        subject: replyData.subject,
        content: replyData.content,
        recipientIds: [selectedMessage.sender_id],
        isBroadcast: false
      });
      setShowReplyModal(false);
      setReplyData({ subject: '', content: '' });
      alert('Reply sent successfully!');
    } catch (error) {
      alert(error.response?.data?.error || 'Failed to send reply');
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Inbox</h1>
        <p className="text-gray-600">View and manage your messages</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Message List */}
        <div className="lg:col-span-1">
          <div className="card">
            <div className="flex items-center justify-between mb-4 gap-4">
              <h2 className="font-semibold text-gray-900 text-lg">Messages</h2>
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="input-field text-sm py-1.5 px-3"
              >
                <option value="all">All</option>
                <option value="unread">Unread</option>
              </select>
            </div>

            <div className="space-y-2 max-h-[600px] overflow-y-auto">
              {messages.length === 0 ? (
                <p className="text-center text-gray-500 py-8">No messages</p>
              ) : (
                messages.map((message) => (
                  <div
                    key={message.id}
                    onClick={() => handleViewMessage(message)}
                    className={`p-3 rounded-lg cursor-pointer transition-colors ${
                      selectedMessage?.id === message.id
                        ? 'bg-primary-50 border border-primary-200'
                        : message.is_read
                        ? 'bg-gray-50 hover:bg-gray-100'
                        : 'bg-blue-50 hover:bg-blue-100 border border-blue-200'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-1">
                      <div className="flex items-center">
                        {message.is_read ? (
                          <MailOpen size={16} className="text-gray-400 mr-2" />
                        ) : (
                          <Mail size={16} className="text-blue-500 mr-2" />
                        )}
                        <span className={`text-sm font-medium ${message.is_read ? 'text-gray-700' : 'text-gray-900'}`}>
                          {message.sender_first_name} {message.sender_last_name}
                        </span>
                      </div>
                      <span className="text-xs text-gray-500">
                        {new Date(message.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    <p className={`text-sm ${message.is_read ? 'text-gray-600' : 'text-gray-900 font-medium'} truncate`}>
                      {message.subject}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Message Detail */}
        <div className="lg:col-span-2">
          {selectedMessage ? (
            <div className="card">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 pb-4 border-b gap-4">
                <div className="flex-1 min-w-0">
                  <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2 break-words">{selectedMessage.subject}</h2>
                  <div className="flex flex-wrap items-center text-xs sm:text-sm text-gray-600 gap-1">
                    <span className="font-medium">From:</span>
                    <span>{selectedMessage.sender_first_name} {selectedMessage.sender_last_name}</span>
                    <span className="hidden sm:inline mx-1">•</span>
                    <span>{selectedMessage.sender_role}</span>
                    <span className="hidden sm:inline mx-1">•</span>
                    <span className="w-full sm:w-auto">{new Date(selectedMessage.created_at).toLocaleString()}</span>
                  </div>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <button
                    onClick={handleReply}
                    className="btn-primary flex items-center text-xs sm:text-sm px-2 sm:px-4"
                  >
                    <Reply size={16} className="mr-1 sm:mr-2" />
                    Reply
                  </button>
                  <button
                    onClick={() => handleDeleteMessage(selectedMessage.id)}
                    className="btn-danger flex items-center text-xs sm:text-sm px-2 sm:px-4"
                  >
                    <Trash2 size={16} className="mr-1 sm:mr-2" />
                    Delete
                  </button>
                </div>
              </div>

              <div className="prose max-w-none">
                <p className="text-gray-700 whitespace-pre-wrap">{selectedMessage.content}</p>
              </div>
            </div>
          ) : (
            <div className="card flex items-center justify-center h-96">
              <div className="text-center text-gray-500">
                <Mail size={48} className="mx-auto mb-4 opacity-50" />
                <p>Select a message to view</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Reply Modal */}
      {showReplyModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-lg font-semibold text-gray-900">Reply to Message</h3>
              <button
                onClick={() => setShowReplyModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSendReply} className="p-4">
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">To</label>
                <input
                  type="text"
                  value={`${selectedMessage?.sender_first_name} ${selectedMessage?.sender_last_name}`}
                  className="input-field bg-gray-100"
                  disabled
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Subject</label>
                <input
                  type="text"
                  value={replyData.subject}
                  onChange={(e) => setReplyData({ ...replyData, subject: e.target.value })}
                  className="input-field"
                  required
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Message</label>
                <textarea
                  value={replyData.content}
                  onChange={(e) => setReplyData({ ...replyData, content: e.target.value })}
                  className="input-field"
                  rows={5}
                  required
                  placeholder="Type your reply..."
                />
              </div>
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowReplyModal(false)}
                  className="btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={sending}
                  className="btn-primary flex items-center"
                >
                  <Send size={18} className="mr-2" />
                  {sending ? 'Sending...' : 'Send Reply'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Layout>
  );
};

export default Inbox;
