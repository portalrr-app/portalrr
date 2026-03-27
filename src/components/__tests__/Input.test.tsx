import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Input } from '../Input';

describe('Input', () => {
  it('renders with a label', () => {
    render(<Input label="Email" value="" onChange={() => {}} />);
    expect(screen.getByLabelText('Email')).toBeDefined();
  });

  it('renders with a hint', () => {
    render(<Input label="Name" hint="Your full name" value="" onChange={() => {}} />);
    expect(screen.getByText('Your full name')).toBeDefined();
  });

  it('renders with an error', () => {
    render(<Input label="Name" error="Required" value="" onChange={() => {}} />);
    expect(screen.getByText('Required')).toBeDefined();
  });

  it('hides hint when error is shown', () => {
    render(<Input label="Name" hint="A hint" error="An error" value="" onChange={() => {}} />);
    expect(screen.queryByText('A hint')).toBeNull();
    expect(screen.getByText('An error')).toBeDefined();
  });

  it('calls onChange when typed in', () => {
    const onChange = vi.fn();
    render(<Input label="Name" value="" onChange={onChange} />);
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'hello' } });
    expect(onChange).toHaveBeenCalledOnce();
  });

  describe('password toggle', () => {
    it('renders toggle button for password type', () => {
      render(<Input label="Password" type="password" value="secret" onChange={() => {}} />);
      expect(screen.getByLabelText('Show password')).toBeDefined();
    });

    it('does not render toggle for text type', () => {
      render(<Input label="Name" type="text" value="" onChange={() => {}} />);
      expect(screen.queryByLabelText('Show password')).toBeNull();
      expect(screen.queryByLabelText('Hide password')).toBeNull();
    });

    it('toggles between show/hide password', () => {
      render(<Input label="Password" type="password" value="secret" onChange={() => {}} />);
      const input = screen.getByLabelText('Password') as HTMLInputElement;

      // Initially password type
      expect(input.type).toBe('password');

      // Click show
      fireEvent.click(screen.getByLabelText('Show password'));
      expect(input.type).toBe('text');

      // Click hide
      fireEvent.click(screen.getByLabelText('Hide password'));
      expect(input.type).toBe('password');
    });
  });

  it('generates id from label', () => {
    render(<Input label="First Name" value="" onChange={() => {}} />);
    const input = screen.getByLabelText('First Name');
    expect(input.id).toBe('first-name');
  });

  it('uses provided id over generated one', () => {
    render(<Input label="Name" id="custom-id" value="" onChange={() => {}} />);
    const input = screen.getByLabelText('Name');
    expect(input.id).toBe('custom-id');
  });
});
