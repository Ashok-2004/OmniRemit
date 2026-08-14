using AutoMapper;
using EmployeeService.DTOs.Requests;
using EmployeeService.DTOs.Responses;
using EmployeeService.Models;

namespace EmployeeService.Mappings;

public class MappingProfile : Profile
{
    public MappingProfile()
    {
        CreateMap<CreateEmployeeRequest, Employee>();

        CreateMap<UpdateEmployeeRequest, Employee>();

        CreateMap<Employee, EmployeeResponse>();
    }
}