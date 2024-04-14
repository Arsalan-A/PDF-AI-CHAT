import { createContext } from 'react';

export const ChatContext = createContext({
  addMessage: () => {},
  message: '',
  handle,
});
