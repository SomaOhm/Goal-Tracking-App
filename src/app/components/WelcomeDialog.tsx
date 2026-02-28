import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Button } from '../components/ui/button';
import { Heart, Calendar, Users, Target } from 'lucide-react';

export const WelcomeDialog: React.FC<{ open: boolean; onClose: () => void }> = ({ open, onClose }) => {
  const [step, setStep] = useState(0);

  const steps = [
    {
      icon: Heart,
      title: 'Welcome to MindBuddy!',
      description: 'Your mental health accountability companion',
      color: '#FFB5A0',
    },
    {
      icon: Target,
      title: 'Set Your Goals',
      description: 'Create daily, weekly, or custom goals to track your wellness journey',
      color: '#C8B3E0',
    },
    {
      icon: Calendar,
      title: 'Track Progress',
      description: 'Mark goals complete, add reflections, and visualize your progress over time',
      color: '#A8D8EA',
    },
    {
      icon: Users,
      title: 'Share with Friends',
      description: 'Join groups to share goals and support each other. Try joining the demo group with code: DEMO99',
      color: '#FFE5A0',
    },
  ];

  const currentStep = steps[step];
  const Icon = currentStep.icon;

  const handleNext = () => {
    if (step < steps.length - 1) {
      setStep(step + 1);
    } else {
      onClose();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="rounded-3xl max-w-md mx-4 bg-white">
        <DialogHeader>
          <div className="flex flex-col items-center mb-4">
            <div
              className="w-20 h-20 rounded-full flex items-center justify-center mb-4"
              style={{ backgroundColor: `${currentStep.color}30` }}
            >
              <Icon className="w-10 h-10" style={{ color: currentStep.color }} />
            </div>
            <DialogTitle className="text-2xl text-[#4A4A4A] text-center">
              {currentStep.title}
            </DialogTitle>
          </div>
        </DialogHeader>

        <div className="space-y-6">
          <p className="text-center text-[#8A8A8A]">{currentStep.description}</p>

          {/* Progress dots */}
          <div className="flex justify-center gap-2">
            {steps.map((_, index) => (
              <div
                key={index}
                className="w-2 h-2 rounded-full transition-all"
                style={{
                  backgroundColor: index === step ? currentStep.color : '#E0E0E0',
                  width: index === step ? '24px' : '8px',
                }}
              />
            ))}
          </div>

          <Button
            onClick={handleNext}
            className="w-full rounded-2xl h-12 text-white"
            style={{ background: `linear-gradient(135deg, ${currentStep.color} 0%, ${currentStep.color}CC 100%)` }}
          >
            {step < steps.length - 1 ? 'Next' : "Let's Go!"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
