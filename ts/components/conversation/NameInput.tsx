import React from 'react';

interface PropsDataType {
  name: string;
}

interface PropsActionsType {
  onNameChange: (name: string) => void;
}

export type PropsType = PropsDataType & PropsActionsType;
type StateType = {
  name: string;
};

export class NameInput extends React.Component<PropsType, StateType> {
  constructor(props: PropsType) {
    super(props);
    this.state = {
      name: props.name,
    };
  }

  handleNameChange(event: React.ChangeEvent<HTMLInputElement>): void {
    this.setState({ name: event.target.value });
  }

  public render(): JSX.Element {
    return (
      <form onSubmit={() => this.props.onNameChange(this.state.name)}>
        <input
          type="text"
          value={this.state.name}
          onChange={event => this.handleNameChange(event)}
        />
        <input type="submit" value="Submit" />
      </form>
    );
  }
}
