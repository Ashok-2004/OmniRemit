using EmployeeService.DTOs.Requests;
using FluentValidation;

namespace EmployeeService.Validators;

public class CreateEmployeeValidator
    : AbstractValidator<CreateEmployeeRequest>
{
    public CreateEmployeeValidator()
    {
        RuleFor(x => x.Name)
            .NotEmpty()
            .MinimumLength(3);

        RuleFor(x => x.Email)
            .NotEmpty()
            .EmailAddress();

        RuleFor(x => x.Department)
            .NotEmpty();

        RuleFor(x => x.Salary)
            .GreaterThan(0);
    }
}