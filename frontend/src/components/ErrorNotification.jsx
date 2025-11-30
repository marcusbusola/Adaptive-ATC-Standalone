import React from 'react';
import styled from 'styled-components';

const Overlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.85);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
`;

const Modal = styled.div`
  background: white;
  padding: 2.5rem;
  border-radius: 8px;
  max-width: 500px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
  text-align: center;
`;

const Title = styled.h2`
  color: #d32f2f;
  margin: 0 0 1rem 0;
  font-size: 1.5rem;
`;

const Message = styled.p`
  font-size: 1.1rem;
  margin: 0 0 1.5rem 0;
  line-height: 1.6;
  color: #333;
`;

const ContactMessage = styled.p`
  font-weight: 600;
  font-size: 1.15rem;
  color: #000;
  margin: 1rem 0 0 0;
`;

const TechnicalDetails = styled.details`
  text-align: left;
  margin-top: 1.5rem;
  font-size: 0.9rem;
  color: #666;
  cursor: pointer;

  summary {
    padding: 0.5rem;
    background: #f5f5f5;
    border-radius: 4px;
    user-select: none;

    &:hover {
      background: #ececec;
    }
  }

  pre {
    margin-top: 0.5rem;
    padding: 0.75rem;
    background: #f9f9f9;
    border: 1px solid #ddd;
    border-radius: 4px;
    overflow-x: auto;
    font-family: 'Courier New', monospace;
    font-size: 0.85rem;
    color: #c7254e;
  }
`;

/**
 * ErrorNotification Component
 *
 * Displays a modal overlay when BlueSky simulator fails to connect.
 * Instructs the user to contact the researcher for assistance.
 *
 * @param {Object} props
 * @param {Error|string} [props.error] - Error details (optional, shown in technical details)
 */
export default function ErrorNotification({ error }) {
  return (
    <Overlay>
      <Modal>
        <Title>⚠️ Connection Error</Title>
        <Message>
          Unable to connect to the simulation system.
        </Message>
        <ContactMessage>
          Please contact the researcher for assistance.
        </ContactMessage>
        {error && (
          <TechnicalDetails>
            <summary>Technical details</summary>
            <pre>{error.toString()}</pre>
          </TechnicalDetails>
        )}
      </Modal>
    </Overlay>
  );
}
