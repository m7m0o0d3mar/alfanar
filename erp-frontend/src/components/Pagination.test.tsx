import { render, screen, fireEvent } from '@testing-library/react';
import Pagination from './Pagination';

describe('Pagination', () => {
  it('renders null when total <= pageSize', () => {
    const { container } = render(<Pagination page={1} pageSize={25} total={20} onChange={vi.fn()} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders page numbers and from-to text', () => {
    render(<Pagination page={1} pageSize={25} total={100} onChange={vi.fn()} />);
    expect(screen.getByText('1–25 of 100')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('4')).toBeInTheDocument();
  });

  it('calls onChange with next page on chevron click', () => {
    const onChange = vi.fn();
    render(<Pagination page={2} pageSize={25} total={100} onChange={onChange} />);
    const buttons = screen.getAllByRole('button');
    const nextBtn = buttons[buttons.length - 1];
    fireEvent.click(nextBtn);
    expect(onChange).toHaveBeenCalledWith(3);
  });

  it('disables prev chevron on page 1', () => {
    render(<Pagination page={1} pageSize={25} total={100} onChange={vi.fn()} />);
    const buttons = screen.getAllByRole('button');
    expect(buttons[0]).toBeDisabled();
  });
});
