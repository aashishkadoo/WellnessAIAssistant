import React from 'react';
import { render } from '@testing-library/react-native';
import App from '../App';

test('renders Wellness AI app', () => {
  const { getByText } = render(<App />);

  expect(getByText('Wellness AI 🌿')).toBeTruthy();
});