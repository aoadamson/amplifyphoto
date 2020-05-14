import React, { Component } from 'react';
import { Connect } from 'aws-amplify-react';
import { Form, Grid, Header, Input, List, Segment } from 'semantic-ui-react';
import { BrowserRouter as Router, Route, NavLink } from 'react-router-dom';
import {v4 as uuid} from 'uuid';
import Amplify, { API, graphqlOperation, Auth } from 'aws-amplify';
import aws_exports from './aws-exports';
import { withAuthenticator } from 'aws-amplify-react';
import '@aws-amplify/ui/dist/style.css';
import * as mutations from './graphql/mutations'
import * as queries from './graphql/queries'

Amplify.configure(aws_exports);

function makeComparator(key, order='asc') {
  return (a, b) => {
    if(!a.hasOwnProperty(key) || !b.hasOwnProperty(key)) return 0; 

    const aVal = (typeof a[key] === 'string') ? a[key].toUpperCase() : a[key];
    const bVal = (typeof b[key] === 'string') ? b[key].toUpperCase() : b[key];

    let comparison = 0;
    if (aVal > bVal) comparison = 1;
    if (aVal < bVal) comparison = -1;

    return order === 'desc' ? (comparison * -1) : comparison
  };
}


class NewAlbum extends Component {
  constructor(props) {
    super(props);
    this.state = {
      albumName: ''
     };
   }

  handleChange = (event) => {
    let change = {};
    change[event.target.name] = event.target.value;
    this.setState(change);
  }

  handleSubmit = async (event) => {
    event.preventDefault();
    
    try {
      const user = await Auth.currentUserInfo()
      const result = await API.graphql(graphqlOperation(mutations.createAlbum, { input: {name:this.state.albumName, owner: user.username} }));
      console.info(`Created album with id ${result.data.createAlbum.id}`);
      window.confirm('created: ' + this.state.albumName + ' Reload page!')
      this.setState({ albumName: ''});
    }
    catch (err) {
      console.error('NewAlbum mutation failed', err);
    }
  }

  render() {
    return (
      <Segment>
        <Header as='h3'>Add a new album</Header>
         <Input
          type='text'
          placeholder='New Album Name'
          icon='plus'
          iconPosition='left'
          action={{ content: 'Create', onClick: this.handleSubmit }}
          name='albumName'
          value={this.state.albumName}
          onChange={this.handleChange}
         />
        </Segment>
      )
   }
}
class AlbumsList extends React.Component {
  albumItems() {
    return this.props.albums.sort(makeComparator('name')).map(album =>
      <List.Item key={album.id}>
        <NavLink to={`/albums/${album.id}`}>{album.name}</NavLink>
      </List.Item>
    );
  }

  render() {
    return (
      <Segment>
        <Header as='h3'>My Albums</Header>
        <List divided relaxed>
          {this.albumItems()}
        </List>
      </Segment>
    );
  }
}

class AlbumDetailsLoader extends React.Component {
  render() {
    return (
      <Connect query={graphqlOperation(queries.getAlbum, { id: this.props.id })}>
        {({ data, loading, errors }) => {
          if (loading) { return <div>Loading...</div>; }
          if (errors.length > 0) { return <div>{JSON.stringify(errors)}</div>; }
          if (!data.getAlbum) return;
          return <AlbumDetails album={data.getAlbum} />;
        }}
      </Connect>
    );
  }
}

class AlbumsListLoader extends React.Component {

  render() {
    return (
      <Connect query={graphqlOperation(queries.listAlbums)}>
        {({ data, loading, errors }) => {
          if (loading) { return <div>Loading...</div>; }
          if (!data.listAlbums) return;

          return <AlbumsList albums={data.listAlbums.items} />;
        }}
      </Connect>
    );
  }
}

class S3ImageUpload extends React.Component {
  constructor(props) {
    super(props);
    this.state = { uploading: false }
  }
  onChange = async (e) => {
    const file = e.target.files[0];
    const fileName = uuid();
    this.setState({uploading: true});
    const result = await Storage.put(
      fileName, 
      file, 
      {
        customPrefix: { public: 'uploads/' },
        metadata: { albumid: this.props.albumId }
      }
    );
    console.log('Uploaded file: ', result);
    this.setState({uploading: false});
  }
  render() {
    return (
      <div>
        <Form.Button
          onClick={() => document.getElementById('add-image-file-input').click()}
          disabled={this.state.uploading}
          icon='file image outline'
          content={ this.state.uploading ? 'Uploading...' : 'Add Image' }
        />
        <input
          id='add-image-file-input'
          type="file"
          accept='image/*'
          onChange={this.onChange}
          style={{ display: 'none' }}
        />
      </div>
    );
  }
}

class AlbumDetails extends Component {
  render() {
    return (
      <Segment>
        <Header as='h3'>{this.props.album.name}</Header>
        <S3ImageUpload albumId={this.props.album.id}/>        
        <p>TODO: Show photos for this album</p>
      </Segment>
    )
  }
}

class App extends Component {
  // render() {
  //   return (
  //     <Grid padded>
  //       <Grid.Column>
  //         <NewAlbum />
  //         <AlbumsListLoader />
  //       </Grid.Column>
  //     </Grid>
  //   );
  // }
  render() {
    return (
      <Router>
        <Grid padded>
          <Grid.Column>
            <Route path="/" exact component={NewAlbum}/>
            <Route path="/" exact component={AlbumsListLoader}/>
            <Route
              path="/albums/:albumId"
              render={ () => <div><NavLink to='/'>Back to Albums list</NavLink></div> }
            />
            <Route
              path="/albums/:albumId"
              render={ props => <AlbumDetailsLoader id={props.match.params.albumId}/> }
            />
          </Grid.Column>
        </Grid>
      </Router>
    );
  }
}
export default withAuthenticator(App, {includeGreetings: true});