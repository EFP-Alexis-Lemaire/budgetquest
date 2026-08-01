import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useStore } from '@/store';
import { Card, Button, Input, Badge } from '@/components';
import { DollarSign, Calendar, Gift, Savings } from 'lucide-react';

const BudgetDashboard = () => {
  const { data: budgetData } = useQuery(['budgetData'], fetchBudgetData);
  const { monthlyExpenses, fixedExpenses, savingsGoal } = useStore();

  return (
    <div className="bg-gray-950 text-white p-6 space-y-6">
      <h1 className="text-3xl font-bold text-center">BudgetQuest Dashboard</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Card className="p-4">
          <h2 className="text-xl font-semibold flex items-center">
            <DollarSign className="mr-2" /> Monthly Budget
          </h2>
          <Input 
            type="number" 
            placeholder="Enter your budget" 
            className="mt-2"
          />
          <Button className="btn-primary mt-4">Set Budget</Button>
        </Card>

        <Card className="p-4">
          <h2 className="text-xl font-semibold flex items-center">
            <Calendar className="mr-2" /> Fixed Expenses
          </h2>
          <ul className="mt-2 space-y-2">
            {fixedExpenses.map(expense => (
              <li key={expense.id} className="flex justify-between">
                <span>{expense.name}</span>
                <Badge className="bg-red-500">{expense.amount}</Badge>
              </li>
            ))}
          </ul>
        </Card>

        <Card className="p-4">
          <h2 className="text-xl font-semibold flex items-center">
            <Gift className="mr-2" /> Upcoming Events
          </h2>
          <ul className="mt-2 space-y-2">
            {budgetData?.upcomingEvents.map(event => (
              <li key={event.id} className="flex justify-between">
                <span>{event.name}</span>
                <Badge className="bg-blue-500">{event.date}</Badge>
              </li>
            ))}
          </ul>
        </Card>

        <Card className="p-4">
          <h2 className="text-xl font-semibold flex items-center">
            <Savings className="mr-2" /> Savings Goal
          </h2>
          <Input 
            type="number" 
            placeholder="Enter savings goal" 
            className="mt-2"
          />
          <Button className="btn-secondary mt-4">Set Goal</Button>
        </Card>
      </div>
    </div>
  );
};

export default BudgetDashboard;