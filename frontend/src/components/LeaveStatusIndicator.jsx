import React from 'react';
import { CheckCircle, Circle, XCircle } from 'lucide-react';

const LeaveStatusIndicator = ({ status, supervisorStatus, hrStatus, ceoApproval = false, applicantRole }) => {
  // HR and HOD go directly to CEO (2-step flow)
  const isShortFlow = ceoApproval || ['HR', 'HOD'].includes(applicantRole);

  const getStepStatus = (step) => {
    if (isShortFlow) {
      // Short flow: Applied -> CEO
      if (step === 1) return 'completed';
      if (step === 2) {
        if (status === 'Approved') return 'completed';
        if (status === 'Rejected') return 'rejected';
        return 'pending';
      }
    } else {
      // Normal flow: Applied -> Supervisor -> HR
      if (step === 1) return 'completed';
      if (step === 2) {
        if (supervisorStatus === 'Approved') return 'completed';
        if (supervisorStatus === 'Rejected') return 'rejected';
        return 'pending';
      }
      if (step === 3) {
        if (hrStatus === 'Approved') return 'completed';
        if (hrStatus === 'Rejected') return 'rejected';
        return 'pending';
      }
    }
    return 'pending';
  };

  const renderCircle = (stepStatus) => {
    if (stepStatus === 'completed') {
      return <CheckCircle size={14} className="text-green-500" />;
    } else if (stepStatus === 'rejected') {
      return <XCircle size={14} className="text-red-500" />;
    } else {
      return <Circle size={14} className="text-gray-300" />;
    }
  };

  if (isShortFlow) {
    // Short flow: Applied -> CEO
    const step1Status = getStepStatus(1);
    const step2Status = getStepStatus(2);
    
    return (
      <div className="flex items-center gap-1">
        <div className="flex flex-col items-center">
          {renderCircle(step1Status)}
          <span className="text-[10px] text-gray-500">Applied</span>
        </div>
        <div className={`h-0.5 w-4 ${step1Status === 'completed' ? 'bg-green-500' : 'bg-gray-300'}`}></div>
        <div className="flex flex-col items-center">
          {renderCircle(step2Status)}
          <span className="text-[10px] text-gray-500">CEO</span>
        </div>
      </div>
    );
  }

  // Normal flow: Applied -> Supervisor/HOD -> HR
  // For Supervisor applicants, it goes to HOD for approval
  const step1Status = getStepStatus(1);
  const step2Status = getStepStatus(2);
  const step3Status = getStepStatus(3);
  const approverLabel = applicantRole === 'Supervisor' ? 'HOD' : 'Sup';

  return (
    <div className="flex items-center gap-1">
      <div className="flex flex-col items-center">
        {renderCircle(step1Status)}
        <span className="text-[10px] text-gray-500">Applied</span>
      </div>
      <div className={`h-0.5 w-4 ${step1Status === 'completed' ? 'bg-green-500' : 'bg-gray-300'}`}></div>
      <div className="flex flex-col items-center">
        {renderCircle(step2Status)}
        <span className="text-[10px] text-gray-500">{approverLabel}</span>
      </div>
      <div className={`h-0.5 w-4 ${step2Status === 'completed' ? 'bg-green-500' : 'bg-gray-300'}`}></div>
      <div className="flex flex-col items-center">
        {renderCircle(step3Status)}
        <span className="text-[10px] text-gray-500">HR</span>
      </div>
    </div>
  );
};

export default LeaveStatusIndicator;
