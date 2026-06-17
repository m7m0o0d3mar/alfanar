import { render, screen, fireEvent } from '@testing-library/react';
import EmptyState from './EmptyState';

describe('EmptyState', () => {
  it('renders title and description', () => {
    render(<EmptyState title="No items" description="Create your first item." />);
    expect(screen.getByText('No items')).toBeInTheDocument();
    expect(screen.getByText('Create your first item.')).toBeInTheDocument();
  });

  it('renders action button when actionLabel and onAction provided', () => {
    render(<EmptyState title="No items" description="Create one." actionLabel="Add Item" onAction={vi.fn()} />);
    expect(screen.getByRole('button', { name: /Add Item/ })).toBeInTheDocument();
  });

  it('calls onAction when button clicked', () => {
    const onAction = vi.fn();
    render(<EmptyState title="No items" description="Create one." actionLabel="Add" onAction={onAction} />);
    fireEvent.click(screen.getByText('Add'));
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it('renders as table row when asTableRow is true', () => {
    const { container } = render(<EmptyState title="No items" description="None." asTableRow />);
    expect(container.querySelector('tr')).toBeInTheDocument();
    expect(container.querySelector('td')).toHaveAttribute('colspan', '99');
  });
});
